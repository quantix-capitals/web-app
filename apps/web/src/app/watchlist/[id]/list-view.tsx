"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { IconWatchlist } from "@/components/shell/nav-icons";
import { ActionStyle, Badge, EmptyState, Section } from "@/components/ui/primitives";
import { cn, formatMoney, formatPercent, formatRelative, moveTone } from "@/lib/format";
import { toYahooSymbol } from "@/lib/market/symbols";
import { useQuotes } from "@/lib/market/use-quotes";
import { removeItem, setEntry } from "@/lib/watchlist/actions";
import { itemPnl, listPnl } from "@/lib/watchlist/pnl";
import type { WatchlistItemView, WatchlistSummary } from "@/lib/watchlist/types";
import { AddSymbol } from "./add-symbol";
import { ListSettings } from "./list-settings";

export function ListView({ list }: { list: WatchlistSummary }) {
  const [showSettings, setShowSettings] = useState(false);
  const yahooSymbols = useMemo(
    () =>
      list.items
        .filter((i) => i.symbol)
        .map((i) => toYahooSymbol({ symbol: i.symbol, exchange: i.exchange })),
    [list.items],
  );
  const { quotes, refresh, status } = useQuotes(yahooSymbols);
  const totals = useMemo(() => listPnl(list.items, quotes), [list.items, quotes]);
  const struck = new Date(list.createdAt).toLocaleDateString();

  return (
    <div className="bg-canvas">
      {/* The back link shares the header's first line rather than owning a row
          of its own above it — one line of chrome, not two. */}
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-line px-6 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href="/watchlist"
              className="text-detail text-ink-subtle hover:text-ink"
              aria-label="Back to watchlist"
            >
              ←
            </Link>
            <h1 className="truncate font-serif text-title tracking-tight text-ink">{list.name}</h1>
            <Badge tone={list.visibility === "public" ? "accent" : "neutral"}>
              {list.visibility === "public" ? "Public" : "Private"}
            </Badge>
            {list.createdBy === "agent" ? <Badge tone="info">Agent</Badge> : null}
          </div>
          <p className="mt-1 text-meta text-ink-muted">
            Struck {struck} · modified {formatRelative(list.updatedAt)}
            {list.description ? ` · ${list.description}` : ""}
          </p>
        </div>
        {list.isOwner ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refresh()}
              className={cn(
                ActionStyle({ variant: "ghost" }),
                status === "loading" && "opacity-60",
              )}
            >
              {status === "loading" ? "Refreshing…" : "Refresh"}
            </button>
            <button
              type="button"
              onClick={() => setShowSettings((s) => !s)}
              aria-expanded={showSettings}
              className={ActionStyle({ variant: "ghost" })}
            >
              Settings
            </button>
          </div>
        ) : null}
      </header>

      <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-b border-line bg-sunken px-6 py-3 text-body">
        <Figure label="Total value" lead>
          {totals.marketValue === null ? "—" : formatMoney(totals.marketValue)}
        </Figure>
        <Figure label="Invested">
          {totals.invested === null ? "—" : formatMoney(totals.invested)}
        </Figure>
        <Figure label={`P&L since ${struck}`} tone={totals.unrealised}>
          {totals.unrealised === null ? "—" : formatMoney(totals.unrealised)}
          {totals.returnPct !== null ? (
            <span className="ml-1.5 text-detail opacity-80">
              {formatPercent(totals.returnPct)}
            </span>
          ) : null}
        </Figure>
        <Figure label="Day change" tone={totals.dayChange}>
          {totals.dayChange === null ? "—" : formatMoney(totals.dayChange)}
        </Figure>
        {totals.pricedCount > 0 && totals.pricedCount < totals.count ? (
          <span className="text-meta text-ink-subtle">
            {totals.pricedCount} of {totals.count} priced
          </span>
        ) : null}
      </dl>

      {list.isOwner ? <AddSymbol listId={list.id} /> : null}
      {showSettings && list.isOwner ? <ListSettings list={list} /> : null}

      <Section flush>
        {list.items.length ? (
          <ItemsTable items={list.items} quotes={quotes} listId={list.id} isOwner={list.isOwner} />
        ) : (
          <EmptyState icon={<IconWatchlist className="size-5" />} title="No symbols yet">
            {list.isOwner
              ? "Search for a symbol above to start tracking this basket."
              : "This basket has no symbols."}
          </EmptyState>
        )}
      </Section>
    </div>
  );
}

function Figure({
  label,
  children,
  tone,
  lead,
}: {
  label: string;
  children: React.ReactNode;
  /** A signed figure colours itself; anything else stays ink. */
  tone?: number | null;
  lead?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-meta text-ink-muted">{label}</dt>
      <dd
        className={cn(
          "tabular-nums",
          lead && "font-serif text-lead",
          tone === null || tone === undefined ? "text-ink" : moveTextClass(tone),
        )}
      >
        {children}
      </dd>
    </div>
  );
}

function ItemsTable({
  items,
  quotes,
  listId,
  isOwner,
}: {
  items: WatchlistItemView[];
  quotes: ReturnType<typeof useQuotes>["quotes"];
  listId: string;
  isOwner: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-220 border-collapse text-body">
        <thead>
          <tr className="border-b border-line bg-sunken text-meta text-ink-muted">
            <th className="px-3 py-2.5 pl-6 text-left font-medium">Symbol</th>
            <th className="px-3 py-2.5 text-right font-medium">Qty</th>
            <th className="px-3 py-2.5 text-right font-medium">Entry</th>
            <th className="px-3 py-2.5 text-right font-medium">Entry date</th>
            <th className="px-3 py-2.5 text-right font-medium">Last</th>
            <th className="px-3 py-2.5 text-right font-medium">Value</th>
            <th className="px-3 py-2.5 text-right font-medium">P&L</th>
            {isOwner ? (
              <th className="px-3 py-2.5 pr-6 text-right font-medium">
                <span className="sr-only">Actions</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <ItemRow key={item.id} item={item} quotes={quotes} listId={listId} isOwner={isOwner} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ItemRow({
  item,
  quotes,
  listId,
  isOwner,
}: {
  item: WatchlistItemView;
  quotes: ReturnType<typeof useQuotes>["quotes"];
  listId: string;
  isOwner: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const yahooSymbol = item.symbol
    ? toYahooSymbol({ symbol: item.symbol, exchange: item.exchange })
    : "";
  const quote = quotes[yahooSymbol];
  const pnl = itemPnl(item, quote);
  const priced = pnl.marketValue !== null;

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
    <tr
      className={cn(
        "border-b border-line last:border-b-0 odd:bg-sunken/60 hover:bg-accent-soft/40",
        pending && "opacity-50",
      )}
    >
      <td className="px-3 py-3 pl-6 text-left">
        <div className="flex items-center gap-2">
          <span className="font-mono font-medium text-ink">{item.symbol}</span>
          <Badge mono>{item.exchange}</Badge>
        </div>
        {item.name ? <div className="mt-0.5 text-meta text-ink-subtle">{item.name}</div> : null}
      </td>
      <td className="px-3 py-3 text-right tabular-nums text-ink-muted">{item.quantity}</td>
      <td className="px-3 py-3 text-right tabular-nums text-ink-muted">
        {item.entryPrice === null ? "—" : formatMoney(item.entryPrice)}
      </td>
      <td className="px-3 py-3 text-right tabular-nums text-ink-muted">
        {item.entryAt ? new Date(item.entryAt).toLocaleDateString() : "—"}
      </td>
      <td className="px-3 py-3 text-right tabular-nums text-ink-muted">
        {quote ? formatMoney(quote.price) : "—"}
      </td>
      <td className="px-3 py-3 text-right tabular-nums text-ink">
        {pnl.marketValue === null ? "—" : formatMoney(pnl.marketValue)}
      </td>
      <td
        className={cn(
          "px-3 py-3 text-right tabular-nums",
          pnl.unrealised === null ? "text-ink-muted" : moveTextClass(pnl.unrealised),
        )}
      >
        {pnl.unrealised === null ? "—" : formatMoney(pnl.unrealised)}
        {pnl.returnPct !== null ? (
          <div className="mt-0.5 text-meta opacity-80">{formatPercent(pnl.returnPct)}</div>
        ) : null}
        {!priced && isOwner ? (
          <button
            type="button"
            onClick={onSetEntry}
            disabled={pending}
            className="mt-0.5 block w-full text-right text-meta text-accent-ink underline-offset-2 hover:underline"
          >
            Set entry
          </button>
        ) : null}
      </td>
      {isOwner ? (
        <td className="px-3 py-3 pr-6 text-right">
          <button
            type="button"
            onClick={onRemove}
            disabled={pending}
            className="text-meta text-ink-subtle hover:text-loss"
          >
            Remove
          </button>
        </td>
      ) : null}
    </tr>
  );
}

function moveTextClass(n: number): string {
  const tone = moveTone(n);
  return tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : "text-ink-muted";
}
