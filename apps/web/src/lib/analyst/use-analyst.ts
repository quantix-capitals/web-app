/**
 * The analyst tab's one hook, for one basket: prices, the brief and the kept
 * runs in; a new run, a question on an old one, and a deletion out.
 *
 * Four separate clocks run here, and keeping them apart is most of the design:
 *
 * 1. **Bars** — slow, rate-limited, never change for a past date. One request for
 *    a 15-month window covering the holdings and the bench, cached an hour.
 * 2. **Quotes** — the refcounted store the ledger is already polling, so the
 *    agent and the table quote the same price by construction.
 * 3. **Stored runs and the brief** — rows in Supabase. Cheap, and read whenever
 *    the basket page is open so the tab can show how many runs there are.
 * 4. **The model** — expensive, and asked exactly when the user asks. Opening
 *    the tab never runs it.
 *
 * **Every run is saved.** A finished run is written before it is shown, and the
 * write happens here rather than through a model tool: a log is only worth
 * keeping if every entry is really there, in the same shape. If the write fails
 * the report is held in memory and the run offers to retry the save, because
 * the run is the part that cost a minute and real money.
 *
 * **Context is chosen, not assumed.** A new run is given the basket's brief
 * (unless unticked) and whichever earlier runs are ticked — the newest by
 * default. The hook lives on the basket page rather than inside the tab, so a
 * run started on the Analyst tab keeps going if the reader flips to the ledger.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toYahooSymbol } from "@stealth/shared";
import { useQuotes } from "@/lib/market/use-quotes";
import type { WatchlistSummary } from "@/lib/watchlist/types";
import { isBriefEmpty, type StoredBrief } from "@/lib/watchlist/brief";
import { getBrief } from "@/services/brief-service";
import {
  deleteRun,
  getRun,
  listRuns,
  recordExchanges,
  runsForContext,
  saveRun,
} from "@/services/analyst-runs-service";
import { fetchHistoryBatched } from "./history";
import { BENCHMARK_SYMBOL, measure, type Book } from "./quant";
import { BENCH } from "./universe";
import { isConfigured, MODEL } from "./client";
import { briefKey, runKey, runsKey } from "./keys";
import { loadAgent } from "./load";
import { renderRunMarkdown, toPriorRun } from "./report";
import type { RunRecord, RunSummary } from "./types";

/**
 * Calendar days of bars fetched.
 *
 * The 200-day average needs 200 *sessions* — roughly 290 calendar days — and the
 * one-year high needs a year. 460 covers both, with room for holidays.
 */
const WINDOW_DAYS = 460;

export type PriceStatus = "idle" | "loading" | "ready" | "error";

export interface UseAnalyst {
  /** True when the build carries no OpenAI key — the tab says where to set one. */
  needsKey: boolean;

  prices: {
    status: PriceStatus;
    error: string | null;
    retry: () => void;
    asOf: string | null;
    /** Holdings the agent can actually judge. */
    holdingCount: number;
    /** Distinct symbols in the basket, priced or not. */
    heldCount: number;
    /** Held symbols the feed returned no price for at all. */
    skipped: string[];
    /** The replacement bench did not load: the run can say sell, not what to buy. */
    benchUnavailable: boolean;
  };

  brief: StoredBrief | null;
  briefLoading: boolean;
  /** A brief exists and says something. */
  briefUsable: boolean;

  runs: RunSummary[];
  runsStatus: "loading" | "ready" | "error";
  runsError: string | null;

  /** The run on screen: the one in the URL, else the newest. Null means "new run". */
  selectedRunId: string | null;
  run: RunRecord | null;
  runStatus: "none" | "loading" | "ready" | "missing" | "error";
  runLoadError: string | null;

  /** Whether the next run is given the brief. */
  includeBrief: boolean;
  setIncludeBrief: (next: boolean) => void;
  /** Which earlier runs the next run is given. The newest, until changed. */
  contextIds: string[];
  setContextIds: (ids: string[]) => void;

  running: boolean;
  /** Labels of the runs the outstanding run was given, for the wait screen. */
  runningContext: string[];
  runError: string | null;
  /** Set when a run finished but its save failed. */
  retrySave: (() => void) | null;
  analyse: () => void;

  /** Ask a follow-up of the run on screen. */
  ask: (question: string) => void;
  /** The question awaiting an answer, if any. */
  asking: string | null;
  askError: string | null;
  canAsk: boolean;

  removeRun: (id: string) => Promise<void>;
}

export function useAnalyst(
  basket: WatchlistSummary,
  options: {
    /** The Analyst tab is showing. Loading prices waits for this. */
    active: boolean;
    /** `?run=` — an id, `"new"`, or null for "the newest". */
    runParam: string | null;
    /** Called with a freshly saved run's id, so the page can open it. */
    onRunSaved: (id: string) => void;
  },
): UseAnalyst {
  const queryClient = useQueryClient();
  const needsKey = !isConfigured();

  const [running, setRunning] = useState(false);
  const [runningContext, setRunningContext] = useState<string[]>([]);
  const [runError, setRunError] = useState<string | null>(null);
  const [retrySave, setRetrySave] = useState<(() => void) | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const [askError, setAskError] = useState<string | null>(null);
  const [includeBrief, setIncludeBrief] = useState(true);
  /** `null` until the reader touches the checkboxes: then the newest run is the default. */
  const [chosen, setChosen] = useState<string[] | null>(null);

  const onSavedRef = useRef(options.onRunSaved);
  onSavedRef.current = options.onRunSaved;

  // --- prices ----------------------------------------------------------------

  /** Held names only — the ones worth a live mark, and the ones being judged. */
  const heldSymbols = useMemo(() => {
    const set = new Set<string>();
    for (const item of basket.items) if (item.symbol) set.add(toYahooSymbol(item));
    return [...set].sort();
  }, [basket.items]);

  /** The replacement bench. The same list for every basket, so its bars cache once. */
  const benchSymbols = useMemo(() => BENCH.map(toYahooSymbol).sort(), []);

  const range = useMemo(() => {
    const to = new Date();
    // Tomorrow: Yahoo's `period2` is exclusive.
    to.setDate(to.getDate() + 1);
    const from = new Date();
    from.setDate(from.getDate() - WINDOW_DAYS);
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
  }, []);

  // A run in flight keeps its prices subscribed even if the tab changes.
  const pricesWanted = (options.active || running) && heldSymbols.length > 0;

  /**
   * Two fetches, not one, because they fail differently: without the holdings
   * there is nothing to judge; without the bench the agent can still say sell,
   * it just cannot name what to buy instead.
   */
  const holdings = useQuery({
    queryKey: ["analyst", basket.id, "holdings-history", { heldSymbols, from: range.from }],
    queryFn: ({ signal }) =>
      fetchHistoryBatched([...heldSymbols, BENCHMARK_SYMBOL], range.from, range.to, signal),
    enabled: pricesWanted,
    staleTime: 60 * 60_000,
    gcTime: 2 * 60 * 60_000,
    retry: 1,
  });

  const bench = useQuery({
    queryKey: ["analyst", "bench-history", { from: range.from }],
    queryFn: ({ signal }) => fetchHistoryBatched(benchSymbols, range.from, range.to, signal),
    enabled: pricesWanted,
    staleTime: 60 * 60_000,
    gcTime: 2 * 60 * 60_000,
    retry: 1,
  });

  const quoteSymbols = useMemo(
    () => (pricesWanted ? [...heldSymbols, BENCHMARK_SYMBOL] : []),
    [heldSymbols, pricesWanted],
  );
  const live = useQuotes(quoteSymbols);

  const book = useMemo(() => {
    if (!holdings.data) return null;
    return measure({
      basket,
      history: [...holdings.data.history, ...(bench.data?.history ?? [])],
      quotes: live.quotes,
      asOf: live.asOf ?? holdings.data.asOf,
    });
  }, [holdings.data, bench.data, basket, live.quotes, live.asOf]);

  /**
   * The book as the outstanding run sees it. A ref, not a dependency: the quote
   * poll rebuilds `book` every few seconds, and a run that restarted whenever
   * prices ticked would never finish.
   */
  const bookRef = useRef<Book | null>(null);
  bookRef.current = book;

  const retryPrices = useCallback(() => {
    void holdings.refetch();
    void bench.refetch();
  }, [holdings, bench]);

  const priceStatus: PriceStatus =
    heldSymbols.length === 0
      ? "ready"
      : holdings.isError
        ? "error"
        : book
          ? "ready"
          : pricesWanted
            ? "loading"
            : "idle";

  // --- stored state ------------------------------------------------------------

  const briefQuery = useQuery({
    queryKey: briefKey(basket.id),
    queryFn: () => getBrief(basket.id),
  });

  const runsQuery = useQuery({
    queryKey: runsKey(basket.id),
    queryFn: () => listRuns(basket.id),
  });
  const runs = useMemo(() => runsQuery.data ?? [], [runsQuery.data]);

  const selectedRunId =
    options.runParam === "new" ? null : (options.runParam ?? runs[0]?.id ?? null);

  const runQuery = useQuery({
    queryKey: runKey(selectedRunId ?? ""),
    queryFn: () => getRun(selectedRunId!),
    enabled: Boolean(selectedRunId),
    // A stored run only changes when this tab changes it, and those writes go
    // straight into the cache.
    staleTime: Infinity,
  });

  const brief = briefQuery.data ?? null;
  const briefUsable = brief !== null && !isBriefEmpty(brief.content);

  const contextIds = useMemo(() => {
    const known = new Set(runs.map((r) => r.id));
    return (chosen ?? runs.slice(0, 1).map((r) => r.id)).filter((id) => known.has(id));
  }, [chosen, runs]);

  // --- a new run ---------------------------------------------------------------

  const analyse = useCallback(() => {
    const current = bookRef.current;
    if (!current || running || needsKey) return;

    const withBrief = briefUsable && includeBrief;
    const ids = contextIds;

    setRunning(true);
    setRunError(null);
    setRetrySave(null);
    setRunningContext(runs.filter((r) => ids.includes(r.id)).map((r) => r.label));

    (async () => {
      const prior = (await runsForContext(ids)).map(toPriorRun);
      const { runReview } = await loadAgent();
      const { report, conversation } = await runReview({
        book: current,
        brief: withBrief ? brief!.content : null,
        briefMarkdown: withBrief ? brief!.markdown : null,
        briefOmitted: briefUsable && !includeBrief,
        prior,
      });

      const model = MODEL ?? null;
      const persist = async () => {
        const record = await saveRun({
          basketId: basket.id,
          model,
          report,
          markdownFor: (label) =>
            renderRunMarkdown(report, {
              basketName: basket.name,
              label,
              model,
              contextLabels: prior.map((p) => p.label),
              briefIncluded: withBrief,
              exchanges: [],
            }),
          briefMarkdown: withBrief ? brief!.markdown : null,
          contextRunIds: prior.map((p) => p.id),
          conversation,
        });
        queryClient.setQueryData(runKey(record.id), record);
        await queryClient.invalidateQueries({ queryKey: runsKey(basket.id) });
        // The next run builds on this one by default.
        setChosen(null);
        onSavedRef.current(record.id);
      };

      const fail = (cause: unknown) => {
        setRunError(`The run finished but was not saved. ${describeFailure(cause)}`);
        setRetrySave(() => () => {
          setRunError(null);
          setRetrySave(null);
          persist().catch(fail);
        });
      };

      await persist().catch(fail);
    })()
      .catch((cause: unknown) => setRunError(describeFailure(cause)))
      .finally(() => setRunning(false));
  }, [
    running,
    needsKey,
    briefUsable,
    includeBrief,
    contextIds,
    runs,
    brief,
    basket.id,
    basket.name,
    queryClient,
  ]);

  // --- questions on a stored run -----------------------------------------------

  const record = runQuery.data ?? null;

  const ask = useCallback(
    (question: string) => {
      const text = question.trim();
      const current = bookRef.current;
      if (!text || !record || !current || asking || needsKey) return;

      setAsking(text);
      setAskError(null);

      (async () => {
        const { askAnalyst } = await loadAgent();
        const { text: answer, conversation } = await askAnalyst(
          {
            book: current,
            // The brief the run was judged against, when it had one. The tools
            // check targets and stops against it.
            brief: record.briefMarkdown ? (brief?.content ?? null) : null,
            briefMarkdown: record.briefMarkdown,
            briefOmitted: false,
            prior: [],
          },
          record.conversation,
          record.markdown,
          text,
        );

        const exchanges = [
          ...record.exchanges,
          { at: new Date().toISOString(), question: text, answer },
        ];
        const markdown = renderRunMarkdown(record.report, {
          basketName: basket.name,
          label: record.label,
          model: record.model,
          contextLabels: record.contextRunIds.map(
            (id) => runs.find((r) => r.id === id)?.label ?? "a deleted run",
          ),
          briefIncluded: record.briefMarkdown !== null,
          exchanges,
        });

        // Shown first, saved second: an answer that failed to save is still an
        // answer, and the error says it will not be there next time.
        const updated: RunRecord = { ...record, exchanges, markdown, conversation };
        queryClient.setQueryData(runKey(record.id), updated);
        try {
          await recordExchanges(record.id, { exchanges, markdown, conversation });
        } catch (cause) {
          setAskError(`Answered, but not saved to the run. ${describeFailure(cause)}`);
        }
      })()
        .catch((cause: unknown) => setAskError(describeFailure(cause)))
        .finally(() => setAsking(null));
    },
    [record, asking, needsKey, brief, basket.name, runs, queryClient],
  );

  const removeRun = useCallback(
    async (id: string) => {
      await deleteRun(id);
      queryClient.removeQueries({ queryKey: runKey(id) });
      await queryClient.invalidateQueries({ queryKey: runsKey(basket.id) });
    },
    [basket.id, queryClient],
  );

  const runStatus: UseAnalyst["runStatus"] = !selectedRunId
    ? "none"
    : runQuery.isError
      ? "error"
      : runQuery.isPending
        ? "loading"
        : record
          ? "ready"
          : "missing";

  return {
    needsKey,
    prices: {
      status: priceStatus,
      error: holdings.isError
        ? `Could not load prices for this basket${
            holdings.error instanceof Error ? ` — ${holdings.error.message}` : ""
          }.`
        : null,
      retry: retryPrices,
      asOf: live.asOf ?? holdings.data?.asOf ?? null,
      holdingCount: book?.holdings.length ?? 0,
      heldCount: heldSymbols.length,
      skipped: book?.skipped ?? [],
      benchUnavailable:
        bench.isError || (bench.isSuccess && book !== null && book.candidates.length === 0),
    },
    brief,
    briefLoading: briefQuery.isPending,
    briefUsable,
    runs,
    runsStatus: runsQuery.isError ? "error" : runsQuery.isPending ? "loading" : "ready",
    runsError: runsQuery.isError ? describeFailure(runsQuery.error) : null,
    selectedRunId,
    run: record,
    runStatus,
    runLoadError: runQuery.isError ? describeFailure(runQuery.error) : null,
    includeBrief,
    setIncludeBrief,
    contextIds,
    setContextIds: setChosen,
    running,
    runningContext,
    runError,
    retrySave,
    analyse,
    ask,
    asking,
    askError,
    canAsk: Boolean(record && book && !needsKey),
    removeRun,
  };
}

/**
 * A failure, in a sentence the user can act on.
 *
 * The SDK's own errors are accurate and unreadable, and the ones that actually
 * happen have different fixes.
 */
export function describeFailure(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : String(cause);
  if (/watchlist_(briefs|analyst_runs)/i.test(message) && /does not exist|schema cache|not find/i.test(message)) {
    return "The brief and run tables are missing. Apply supabase/migrations/0004_watchlist_briefs_and_analyst_runs.sql.";
  }
  if (/401|invalid[_ ]api[_ ]key|Incorrect API key/i.test(message)) {
    return "OpenAI rejected the key. Check OPENAI_API_KEY in apps/web/.env.local.";
  }
  if (/429|rate limit|quota/i.test(message)) {
    return "OpenAI is rate-limiting or the account is out of quota. Try again shortly.";
  }
  if (/CORS|Failed to fetch|NetworkError/i.test(message)) {
    return "The request did not complete. Check the network, then try again.";
  }
  return `The analyst failed: ${message}`;
}
