"use client";

import { useMemo, useTransition } from "react";
import { IconWatchlist } from "@/components/shell/nav-icons";
import {
  ActionStyle,
  BackLink,
  Badge,
  EmptyState,
  Section,
  Stat,
  StatBand,
} from "@/components/ui/primitives";
import { HeadRow, RowAction, Sub, Table, Td, Th, Tr } from "@/components/ui/table";
import { cn, formatDate, formatMoney, formatPercent, formatRelative, moveTone } from "@/lib/format";
import { toYahooSymbol } from "@/lib/market/symbols";
import { useQuotes } from "@/lib/market/use-quotes";
import { removeItem, setEntry } from "@/lib/watchlist/actions";
import { itemPnl, listPnl } from "@/lib/watchlist/pnl";
import type { WatchlistItemView, WatchlistSummary } from "@/lib/watchlist/types";
import { AddSymbol } from "./add-symbol";
import { ListSettings } from "./list-settings";

export function ListView({ list }: { list: WatchlistSummary }) {
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
    value === null ? (loadingPrices ? "Loading…" : "—") : formatMoney(value, signed);

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
            <ListSettings list={list} />
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

      {list.isOwner ? <AddSymbol listId={list.id} /> : null}

      <Section flush>
        {list.items.length ? (
          <ItemsTable
            items={list.items}
            quotes={quotes}
            status={status}
            missing={missing}
            onRetry={refresh}
            listId={list.id}
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
  listId,
  isOwner,
}: {
  items: WatchlistItemView[];
  quotes: ReturnType<typeof useQuotes>["quotes"];
  status: ReturnType<typeof useQuotes>["status"];
  missing: string[];
  onRetry: () => void;
  listId: string;
  isOwner: boolean;
}) {
  return (
    <Table>
      <HeadRow>
        <Th align="left" first>
          Symbol
        </Th>
        <Th>Qty</Th>
        <Th>Entry</Th>
        <Th>Entry date</Th>
        <Th>Last</Th>
        <Th>Value</Th>
        <Th>P&L</Th>
        {isOwner ? (
          <Th last srOnly>
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
            listId={listId}
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
  listId,
  isOwner,
}: {
  item: WatchlistItemView;
  quotes: ReturnType<typeof useQuotes>["quotes"];
  status: ReturnType<typeof useQuotes>["status"];
  missing: string[];
  onRetry: () => void;
  listId: string;
  isOwner: boolean;
}) {
  const [pending, startTransition] = useTransition();
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
  const priceCell = stillLoading ? "Loading…" : "—";

  function onRemove() {
    startTransition(async () => {
      await removeItem(item.id, listId);
    });
  }

  function onSetEntry() {
    startTransition(async () => {
      await setEntry(item.id, listId, {
        at: item.entryAt ?? undefined,
        symbol: item.symbol,
        exchange: item.exchange,
      });
    });
  }

  return (
    <Tr dimmed={pending}>
      <Td align="left" first>
        <div className="flex items-center gap-2">
          <span className="font-mono font-medium text-ink">{item.symbol}</span>
          <Badge mono>{item.exchange}</Badge>
        </div>
        {item.name ? <Sub>{item.name}</Sub> : null}
      </Td>
      <Td className="text-ink-muted">{item.quantity}</Td>
      <Td className="text-ink-muted">
        {item.entryPrice === null ? "—" : formatMoney(item.entryPrice)}
      </Td>
      <Td className="text-ink-muted">{item.entryAt ? formatDate(item.entryAt) : "—"}</Td>
      <Td className="text-ink-muted">{quote ? formatMoney(quote.price) : priceCell}</Td>
      <Td className="text-ink">
        {pnl.marketValue === null ? priceCell : formatMoney(pnl.marketValue)}
      </Td>
      <Td className={pnl.unrealised === null ? "text-ink-muted" : moveTextClass(pnl.unrealised)}>
        {pnl.unrealised === null ? priceCell : formatMoney(pnl.unrealised, true)}
        {pnl.returnPct !== null ? (
          <Sub className={cn("opacity-80", moveTextClass(pnl.unrealised ?? 0))}>
            {formatPercent(pnl.returnPct)}
          </Sub>
        ) : null}
        {!hasBaseline && isOwner ? (
          <button
            type="button"
            onClick={onSetEntry}
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
        <Td last>
          <RowAction danger onClick={onRemove} disabled={pending}>
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
