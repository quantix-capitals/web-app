import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shell/page-header";
import { IconWatchlist } from "@/components/shell/nav-icons";
import { Badge, EmptyState, Section, StatInline, SymbolLink, Tabs } from "@/components/ui/primitives";
import { HeadRow, Sub, Table, Td, Th, Tr, RowAction } from "@/components/ui/table";
import {
  cn,
  formatClock,
  formatDate,
  formatMoney,
  formatPercent,
  formatRelative,
  moveTone,
} from "@/lib/format";
import { toYahooSymbol } from "@stealth/shared";
import { useQuotes } from "@/lib/market/use-quotes";
import {
  deleteBasket,
  myBaskets,
  publicBaskets,
} from "@/services/watchlist-service";
import { basketsKey } from "./keys";
import { useAuth } from "@/context/auth-context";
import { ActionStyle, PageSpinner } from "@/components/ui/primitives";
import { listPnl } from "@/lib/watchlist/pnl";
import type { WatchlistItemView, WatchlistSummary } from "@/lib/watchlist/types";
import { NewBasketButton } from "./new-basket-button";

/**
 * The index of everything you've struck.
 *
 * It is built as a ledger, not a dashboard: one band of totals, one table, and
 * nothing floating. Three decisions carry it.
 *
 * 1. **The slack goes to the name.** Every figure column is shrink-to-fit, so
 *    on a wide screen the numbers stay clustered at the right margin and the
 *    basket's name absorbs the surplus. The layout before this shared that
 *    surplus out evenly and left a basket and its value at opposite ends of the
 *    display with nothing in between.
 * 2. **A row says what is in it.** The description moved under the name, and
 *    the column it freed now shows the actual symbols — so the table answers
 *    "which basket is this?" without a click, which was the only reason to
 *    click.
 * 3. **Colour stays on the figures.** Gain and loss are the only saturated
 *    things here; everything else is ink, rule and space.
 */

type Quotes = ReturnType<typeof useQuotes>["quotes"];

/**
 * Two queries rather than one: "mine" and "public" are different RLS paths and
 * different sizes, and a slow public list should not hold up your own baskets.
 */
export function Watchlist() {
  const { user, loading } = useAuth();
  const [mine, shared] = useQueries({
    queries: [
      { queryKey: [...basketsKey(), "mine"], queryFn: myBaskets, enabled: Boolean(user) },
      { queryKey: [...basketsKey(), "public"], queryFn: publicBaskets, enabled: Boolean(user) },
    ],
  });

  if (loading) return <PageSpinner />;

  if (!user) {
    return (
      <BasketsShell>
        <EmptyState
          icon={<IconWatchlist className="size-5" />}
          title="Sign in to build a basket"
          action={
            <Link to="/profile" className={ActionStyle()}>
              Sign in
            </Link>
          }
        >
          A basket is a named, dated list of symbols with quantities — the way to test
          whether a set of picks, yours or the agent&apos;s, actually worked.
        </EmptyState>
      </BasketsShell>
    );
  }

  if (mine.isPending || shared.isPending) return <PageSpinner />;

  const mineData = mine.data ?? [];
  const sharedData = shared.data ?? [];

  if (!mineData.length && !sharedData.length) {
    return (
      <BasketsShell>
        <EmptyState
          icon={<IconWatchlist className="size-5" />}
          title="Your watchlist is empty"
          action={<NewBasketButton label="Create your first basket" />}
        >
          A basket is a named, dated list of symbols with quantities — the way to test
          whether a set of picks, yours or the agent&apos;s, actually worked.
        </EmptyState>
      </BasketsShell>
    );
  }

  return <ListsView mine={mineData} shared={sharedData} />;
}

/** The page's header and ground, around whichever empty state applies. */
function BasketsShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-canvas">
      <PageHeader
        title="Watchlist"
        subtitle="Dated baskets of symbols, and whether they've made money since you struck them."
      />
      <Section flush>{children}</Section>
    </div>
  );
}

function ListsView({
  mine,
  shared,
}: {
  mine: WatchlistSummary[];
  shared: WatchlistSummary[];
}) {
  const [tab, setTab] = useState<"mine" | "public">("mine");
  const lists = tab === "mine" ? mine : shared;

  const allSymbols = useMemo(() => {
    const set = new Set<string>();
    for (const list of [...mine, ...shared]) {
      for (const item of list.items) {
        if (item.symbol) set.add(toYahooSymbol({ symbol: item.symbol, exchange: item.exchange }));
      }
    }
    return [...set];
  }, [mine, shared]);

  const { quotes, status, asOf, refresh } = useQuotes(allSymbols);

  const totals = useMemo(() => listPnl(lists.flatMap((l) => l.items), quotes), [lists, quotes]);

  const sorted = useMemo(() => {
    return [...lists].sort((a, b) => {
      const av = listPnl(a.items, quotes).marketValue ?? -Infinity;
      const bv = listPnl(b.items, quotes).marketValue ?? -Infinity;
      return bv - av;
    });
  }, [lists, quotes]);

  return (
    <div className="bg-canvas">
      <PageHeader
        title="Watchlist"
        subtitle="Dated baskets of symbols, and whether they've made money since you struck them."
        actions={<NewBasketButton />}
      />

      {/* Tabs and totals share one band, but not one baseline: the tabs sit on
          the rule they underline, and the figures are centred against them. */}
      <Section>
        <div className="flex flex-wrap items-center justify-between gap-x-10 gap-y-2 bg-sunken pr-6">
          <Tabs
            active={tab}
            onChange={setTab}
            tabs={[
              { id: "mine", label: "Your baskets", count: mine.length },
              { id: "public", label: "Shared with you", count: shared.length },
            ]}
          />
          <Totals totals={totals} />
        </div>
      </Section>

      {status === "error" ? <FeedError onRetry={refresh} /> : null}

      <Section flush>
        {sorted.length ? (
          <>
            <ListTable
              lists={sorted}
              quotes={quotes}
              loading={status === "loading"}
              showOwner={tab === "public"}
            />
            <Footnote count={sorted.length} symbols={allSymbols.length} asOf={asOf} />
          </>
        ) : (
          <EmptyState
            icon={<IconWatchlist className="size-5" />}
            title="Nothing here yet"
            action={tab === "mine" ? <NewBasketButton label="Add your first basket" /> : undefined}
          >
            {tab === "mine"
              ? "Create a basket to get started."
              : "No one else has shared a public basket yet — your own public baskets stay under “Your baskets”, badged Public."}
          </EmptyState>
        )}
      </Section>
    </div>
  );
}

function Totals({ totals }: { totals: ReturnType<typeof listPnl> }) {
  if (totals.marketValue === null && totals.invested === null) return null;

  return (
    <StatInline
      // The tabs carry the page gutter themselves; the totals only need one on
      // the narrow screens where they wrap onto their own line and would
      // otherwise start flush against the edge of the display.
      className="py-2.5 max-sm:px-6"
      items={[
        {
          label: "Total value",
          value: totals.marketValue === null ? "—" : formatMoney(totals.marketValue),
        },
        {
          label: "Invested",
          value: totals.invested === null ? "—" : formatMoney(totals.invested),
        },
        {
          label: "Day change",
          value: totals.dayChange === null ? "—" : formatMoney(totals.dayChange, true),
          tone: totals.dayChange === null ? "neutral" : moveTone(totals.dayChange),
        },
        {
          label: "Total gain",
          value: totals.unrealised === null ? "—" : formatMoney(totals.unrealised, true),
          hint: totals.returnPct === null ? undefined : formatPercent(totals.returnPct),
          tone: totals.unrealised === null ? "neutral" : moveTone(totals.unrealised),
        },
      ]}
    />
  );
}

/** The feed is either answering or it isn't, and a dash cannot say which. */
function FeedError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-line bg-loss-soft px-6 py-2.5 text-detail text-loss">
      <span>Price feed unavailable — the figures below are the last ones we had.</span>
      <button type="button" onClick={onRetry} className="font-medium underline underline-offset-2">
        Retry
      </button>
    </div>
  );
}

/**
 * The line that closes the table. Two rows on a tall screen leave a lot of
 * ground below them, and a page that simply stops reads unfinished; a quiet
 * provenance line gives the space a bottom edge and says where the figures
 * above it came from.
 */
function Footnote({
  count,
  symbols,
  asOf,
}: {
  count: number;
  symbols: number;
  asOf: string | null;
}) {
  return (
    <p className="px-6 py-3.5 text-meta text-ink-subtle">
      {count} {count === 1 ? "basket" : "baskets"} · {symbols}{" "}
      {symbols === 1 ? "symbol" : "symbols"} priced from Yahoo
      {asOf ? ` · as of ${formatClock(asOf)}` : ""}
    </p>
  );
}

function ListTable({
  lists,
  quotes,
  loading,
  showOwner,
}: {
  lists: WatchlistSummary[];
  quotes: Quotes;
  loading: boolean;
  showOwner: boolean;
}) {
  return (
    <Table minWidth="min-w-215">
      <HeadRow>
        <Th align="left" first grow>
          Basket
        </Th>
        <Th align="left" tight>
          Holdings
        </Th>
        <Th tight>Struck</Th>
        {showOwner ? <Th tight>By</Th> : null}
        <Th tight>Value</Th>
        <Th tight>Day</Th>
        <Th tight>Gain / loss</Th>
        <Th last tight srOnly>
          Actions
        </Th>
      </HeadRow>
      <tbody>
        {lists.map((list) => (
          <ListRow
            key={list.id}
            list={list}
            quotes={quotes}
            loading={loading}
            showOwner={showOwner}
          />
        ))}
      </tbody>
    </Table>
  );
}

function ListRow({
  list,
  quotes,
  loading,
  showOwner,
}: {
  list: WatchlistSummary;
  quotes: Quotes;
  loading: boolean;
  showOwner: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => deleteBasket(list.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: basketsKey() }),
  });
  const pending = remove.isPending;
  const pnl = listPnl(list.items, quotes);
  const href = `/watchlist/${list.id}`;
  // "Nothing priced yet" and "still fetching" are different facts, and only one
  // of them is permanent.
  const blank = loading && pnl.pricedCount === 0 && list.items.length > 0 ? "Loading…" : "—";

  function onDelete() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    remove.mutate();
  }

  return (
    <Tr dimmed={pending}>
      <Td align="left" first grow>
        <Link to={href} className="block">
          <span className="flex items-center gap-2">
            <span className="font-medium text-ink">{list.name}</span>
            {list.visibility === "public" ? <Badge tone="accent">Public</Badge> : null}
          </span>
          {list.description ? (
            <Sub className="truncate text-ink-muted">{list.description}</Sub>
          ) : null}
        </Link>
      </Td>
      <Td align="left" tight>
        <Holdings items={list.items} href={href} />
      </Td>
      <Td tight className="text-ink-muted">
        {formatDate(list.createdAt)}
        <Sub>{formatRelative(list.createdAt)}</Sub>
      </Td>
      {showOwner ? (
        <Td tight>
          <Badge tone={list.createdBy === "agent" ? "info" : "neutral"}>
            {list.createdBy === "agent" ? "Agent" : "Member"}
          </Badge>
        </Td>
      ) : null}
      <Td tight className="text-ink">
        {pnl.marketValue === null ? blank : formatMoney(pnl.marketValue)}
        {pnl.pricedCount > 0 && pnl.pricedCount < pnl.count ? (
          <Sub>
            {pnl.pricedCount} of {pnl.count} priced
          </Sub>
        ) : null}
      </Td>
      <Td
        tight
        className={pnl.dayChange === null ? "text-ink-subtle" : moveTextClass(pnl.dayChange)}
      >
        {pnl.dayChange === null ? blank : formatMoney(pnl.dayChange, true)}
      </Td>
      <Td
        tight
        className={pnl.unrealised === null ? "text-ink-muted" : moveTextClass(pnl.unrealised)}
      >
        {pnl.unrealised === null ? blank : formatMoney(pnl.unrealised, true)}
        {pnl.returnPct !== null ? (
          <Sub className={cn("opacity-80", moveTextClass(pnl.unrealised ?? 0))}>
            {formatPercent(pnl.returnPct)}
          </Sub>
        ) : null}
      </Td>
      <Td last tight>
        {list.isOwner ? (
          <RowAction
            danger
            armed={confirming}
            onClick={onDelete}
            onBlur={() => setConfirming(false)}
            disabled={pending}
          >
            {confirming ? "Confirm delete" : "Delete"}
          </RowAction>
        ) : null}
      </Td>
    </Tr>
  );
}

/**
 * What is actually in the basket, in the column the description used to waste.
 *
 * Four tickers is what fits before this column starts competing with the name
 * beside it; the rest are counted rather than listed, because past four you are
 * no longer reading them, you are gauging size.
 */
const SHOWN = 4;

function Holdings({ items, href }: { items: WatchlistItemView[]; href: string }) {
  if (items.length === 0) {
    return <span className="text-detail text-ink-subtle">Empty</span>;
  }

  const shown = items.slice(0, SHOWN);
  const rest = items.length - shown.length;

  return (
    // Each ticker is its own link to its quote, so this can't be one big
    // anchor to the basket any more — the overflow count keeps that job.
    <div className="flex items-center gap-1.5">
      {shown.map((item) => (
        <SymbolLink
          key={item.id}
          symbol={item.symbol}
          exchange={item.exchange}
          className="font-mono text-meta font-medium tracking-tight text-ink-muted"
        />
      ))}
      {rest > 0 ? (
        <Link to={href} className="text-meta text-ink-subtle hover:text-ink-muted">
          +{rest}
        </Link>
      ) : null}
    </div>
  );
}

function moveTextClass(n: number): string {
  const tone = moveTone(n);
  return tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : "text-ink-muted";
}
