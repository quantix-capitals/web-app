import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IconWatchlist } from "@/components/shell/nav-icons";
import {
  ActionStyle,
  BackLink,
  Badge,
  EmptyState,
  Section,
  Stat,
  StatBand,
  SymbolLink,
} from "@/components/ui/primitives";
import { HeadRow, RowAction, Sub, Table, Td, Th, Tr } from "@/components/ui/table";
import {
  Skeleton,
  SkeletonCell,
  SkeletonFigure,
  SkeletonRows,
} from "@/components/ui/skeleton";
import { cn, formatDate, formatMoney, formatPercent, formatRelative, moveTone } from "@/lib/format";
import { toYahooSymbol } from "@stealth/shared";
import { useQuotes } from "@/lib/market/use-quotes";
import { itemPnl, listPnl } from "@/lib/watchlist/pnl";
import type { WatchlistItemView, WatchlistSummary } from "@/lib/watchlist/types";
import { AddSymbol } from "./add-symbol";
import { BasketSettings } from "./basket-settings";
import { basketDetail, removeItem, setEntry } from "@/services/watchlist-service";
import { basketKey } from "./keys";
import { NotFound } from "@/pages/not-found";

/**
 * One basket. The id comes from the route; the row comes back scoped by RLS, so
 * a private basket belonging to someone else is indistinguishable from one that
 * does not exist — which is exactly the 404 we want, with no ownership check of
 * our own to get wrong.
 */
export function Basket() {
  const { id = "" } = useParams();
  const { data: list, isPending } = useQuery({
    queryKey: basketKey(id),
    queryFn: () => basketDetail(id),
    enabled: Boolean(id),
  });

  if (isPending) return <BasketLoading />;
  if (!list) return <NotFound />;
  return <BasketView list={list} />;
}

/**
 * A basket whose row hasn't come back yet.
 *
 * Almost nothing on this page is static — the name, the badges, even whether
 * the owner controls appear all wait on the same query — so this traces the
 * page's *structure* instead: header, stat band, ledger. The back link stays
 * real, because it is the one control that works before the data does, and a
 * reader who opened the wrong basket should not have to wait to leave.
 */
function BasketLoading() {
  return (
    <div className="bg-canvas" role="status" aria-label="Loading basket">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-line px-6 py-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <BackLink href="/watchlist" label="Back to watchlist" />
            <Skeleton className="h-6 w-52" />
          </div>
          <Skeleton className="mt-2.5 ml-8 h-3 w-72 max-w-full" />
        </div>
      </header>

      <Section className="bg-sunken">
        <StatBand>
          <Stat label="Total value" value={<SkeletonFigure />} />
          <Stat label="Invested" value={<SkeletonFigure />} />
          <Stat label="P&L" value={<SkeletonFigure />} />
          <Stat label="Day change" value={<SkeletonFigure />} />
        </StatBand>
      </Section>

      <Section flush>
        <Table>
          <HeadRow>
            <Th align="left" first grow>
              Symbol
            </Th>
            <Th tight>Qty</Th>
            <Th tight>Entry</Th>
            <Th tight>Entry date</Th>
            <Th tight>Last</Th>
            <Th tight>Value</Th>
            <Th last tight>
              P&L
            </Th>
          </HeadRow>
          <SkeletonRows
            rows={4}
            columns={[
              {
                align: "left",
                first: true,
                grow: true,
                width: ["w-32", "w-24", "w-40", "w-28"],
                sub: "w-48 max-w-full",
              },
              { tight: true, width: "w-8" },
              { tight: true, width: "w-16" },
              { tight: true, width: "w-20" },
              { tight: true, width: "w-16" },
              { tight: true, width: "w-20" },
              { last: true, tight: true, width: "w-20", sub: "w-10" },
            ]}
          />
        </Table>
      </Section>
    </div>
  );
}

function BasketView({ list }: { list: WatchlistSummary }) {
  const yahooSymbols = useMemo(
    () =>
      list.items
        .filter((i) => i.symbol)
        .map((i) => toYahooSymbol({ symbol: i.symbol, exchange: i.exchange })),
    [list.items],
  );
  const { quotes, refresh, status, error, missing } = useQuotes(yahooSymbols);
  const totals = useMemo(() => listPnl(list.items, quotes), [list.items, quotes]);
  const struck = formatDate(list.createdAt);
  // Nothing priced yet says nothing about *why* — still fetching, the feed
  // came back empty, or it errored are three different facts that all sat
  // behind the same dash before this.
  const loadingPrices = status === "loading" && totals.pricedCount === 0;
  const priced = (value: number | null, signed = false) =>
    value === null ? (loadingPrices ? <SkeletonFigure /> : "—") : formatMoney(value, signed);

  return (
    <div className="bg-canvas">
      {/* The back control shares the header's first line rather than owning a
          row of its own above it — one line of chrome, not two. */}
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-line px-6 py-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <BackLink href="/watchlist" label="Back to watchlist" />
            <h1 className="truncate font-serif text-title tracking-tight text-ink">{list.name}</h1>
            <Badge tone={list.visibility === "public" ? "accent" : "neutral"}>
              {list.visibility === "public" ? "Public" : "Private"}
            </Badge>
            {list.createdBy === "agent" ? <Badge tone="info">Agent</Badge> : null}
          </div>
          {/* Indented to the title, not to the chevron, so the two lines of the
              header share one left edge. */}
          <p className="mt-1.5 pl-8 text-meta text-ink-muted">
            Struck {struck} · modified {formatRelative(list.updatedAt)}
            {list.description ? ` · ${list.description}` : ""}
          </p>
        </div>
        {list.isOwner ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refresh()}
              disabled={status === "loading"}
              className={cn(ActionStyle({ variant: "ghost" }), status === "loading" && "opacity-60")}
            >
              {status === "loading" ? "Refreshing…" : "Refresh"}
            </button>
            <BasketSettings list={list} />
          </div>
        ) : null}
      </header>

      <Section className="bg-sunken">
        <StatBand>
          <Stat
            label="Total value"
            value={priced(totals.marketValue)}
            hint={
              totals.pricedCount > 0 && totals.pricedCount < totals.count
                ? `${totals.pricedCount} of ${totals.count} priced`
                : undefined
            }
          />
          <Stat label="Invested" value={priced(totals.invested)} />
          <Stat
            label={`P&L since ${struck}`}
            value={priced(totals.unrealised, true)}
            hint={totals.returnPct !== null ? formatPercent(totals.returnPct) : undefined}
            tone={totals.unrealised === null ? "neutral" : moveTone(totals.unrealised)}
          />
          <Stat
            label="Day change"
            value={priced(totals.dayChange, true)}
            tone={totals.dayChange === null ? "neutral" : moveTone(totals.dayChange)}
          />
        </StatBand>
      </Section>

      {status === "error" ? (
        <div className="flex flex-wrap items-center gap-3 border-b border-line bg-loss-soft px-6 py-2.5 text-detail text-loss">
          <span>Price feed unavailable{error ? ` — ${error}` : ""}.</span>
          <button type="button" onClick={() => refresh()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : null}

      {list.isOwner ? <AddSymbol basketId={list.id} /> : null}

      <Section flush>
        {list.items.length ? (
          <ItemsTable
            items={list.items}
            quotes={quotes}
            status={status}
            missing={missing}
            onRetry={refresh}
            basketId={list.id}
            isOwner={list.isOwner}
          />
        ) : (
          <EmptyState
            icon={<IconWatchlist className="size-5" />}
            title="No symbols yet"
            action={
              list.isOwner ? (
                <button
                  type="button"
                  onClick={() => document.getElementById("symbol-search")?.focus()}
                  className={ActionStyle()}
                >
                  Add your first symbol
                </button>
              ) : undefined
            }
          >
            {list.isOwner
              ? "Search for a symbol above to start tracking this basket."
              : "This basket has no symbols."}
          </EmptyState>
        )}
      </Section>
    </div>
  );
}

function ItemsTable({
  items,
  quotes,
  status,
  missing,
  onRetry,
  basketId,
  isOwner,
}: {
  items: WatchlistItemView[];
  quotes: ReturnType<typeof useQuotes>["quotes"];
  status: ReturnType<typeof useQuotes>["status"];
  missing: string[];
  onRetry: () => void;
  basketId: string;
  isOwner: boolean;
}) {
  return (
    <Table>
      <HeadRow>
        <Th align="left" first grow>
          Symbol
        </Th>
        <Th tight>Qty</Th>
        <Th tight>Entry</Th>
        <Th tight>Entry date</Th>
        <Th tight>Last</Th>
        <Th tight>Value</Th>
        <Th tight>P&L</Th>
        {isOwner ? (
          <Th last tight srOnly>
            Actions
          </Th>
        ) : null}
      </HeadRow>
      <tbody>
        {items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            quotes={quotes}
            status={status}
            missing={missing}
            onRetry={onRetry}
            basketId={basketId}
            isOwner={isOwner}
          />
        ))}
      </tbody>
    </Table>
  );
}

function ItemRow({
  item,
  quotes,
  status,
  missing,
  onRetry,
  basketId,
  isOwner,
}: {
  item: WatchlistItemView;
  quotes: ReturnType<typeof useQuotes>["quotes"];
  status: ReturnType<typeof useQuotes>["status"];
  missing: string[];
  onRetry: () => void;
  basketId: string;
  isOwner: boolean;
}) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: basketKey(basketId) });

  const remove = useMutation({ mutationFn: () => removeItem(item.id), onSuccess: invalidate });
  const reBaseline = useMutation({
    mutationFn: () =>
      setEntry(item.id, {
        at: item.entryAt ?? undefined,
        symbol: item.symbol,
        exchange: item.exchange,
      }),
    onSuccess: invalidate,
  });
  const pending = remove.isPending || reBaseline.isPending;

  const yahooSymbol = item.symbol
    ? toYahooSymbol({ symbol: item.symbol, exchange: item.exchange })
    : "";
  const quote = quotes[yahooSymbol];
  const pnl = itemPnl(item, quote);
  const hasBaseline = item.entryPrice !== null;
  // A quote that hasn't arrived yet and a quote the feed explicitly couldn't
  // find are different facts — only the latter is something "Set entry"
  // (which re-baselines against today's price) is meant to fix.
  const stillLoading = !quote && status === "loading";
  const feedFailed = !quote && (status === "error" || missing.includes(yahooSymbol));
  const priceCell = stillLoading ? <SkeletonCell /> : "—";

  return (
    <Tr dimmed={pending}>
      <Td align="left" first grow>
        <div className="flex items-center gap-2">
          <SymbolLink
            symbol={item.symbol}
            exchange={item.exchange}
            className="font-mono font-medium text-ink"
          />
          <Badge mono>{item.exchange}</Badge>
        </div>
        {item.name ? <Sub>{item.name}</Sub> : null}
      </Td>
      <Td tight className="text-ink-muted">{item.quantity}</Td>
      <Td tight className="text-ink-muted">
        {item.entryPrice === null ? "—" : formatMoney(item.entryPrice)}
      </Td>
      <Td tight className="text-ink-muted">{item.entryAt ? formatDate(item.entryAt) : "—"}</Td>
      <Td tight className="text-ink-muted">{quote ? formatMoney(quote.price) : priceCell}</Td>
      <Td tight className="text-ink">
        {pnl.marketValue === null ? priceCell : formatMoney(pnl.marketValue)}
      </Td>
      <Td tight className={pnl.unrealised === null ? "text-ink-muted" : moveTextClass(pnl.unrealised)}>
        {pnl.unrealised === null ? priceCell : formatMoney(pnl.unrealised, true)}
        {pnl.returnPct !== null ? (
          <Sub className={cn("opacity-80", moveTextClass(pnl.unrealised ?? 0))}>
            {formatPercent(pnl.returnPct)}
          </Sub>
        ) : null}
        {!hasBaseline && isOwner ? (
          <button
            type="button"
            onClick={() => reBaseline.mutate()}
            disabled={pending}
            className="mt-0.5 block w-full text-right text-meta text-accent-ink underline-offset-2 hover:underline"
          >
            Set entry
          </button>
        ) : null}
        {hasBaseline && feedFailed ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-0.5 block w-full text-right text-meta text-accent-ink underline-offset-2 hover:underline"
          >
            Price unavailable — retry
          </button>
        ) : null}
      </Td>
      {isOwner ? (
        <Td last tight>
          <RowAction danger onClick={() => remove.mutate()} disabled={pending}>
            Remove
          </RowAction>
        </Td>
      ) : null}
    </Tr>
  );
}

function moveTextClass(n: number): string {
  const tone = moveTone(n);
  return tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : "text-ink-muted";
}
