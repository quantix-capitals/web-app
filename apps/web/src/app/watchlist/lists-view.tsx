"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { IconWatchlist } from "@/components/shell/nav-icons";
import { Badge, EmptyState, Section, Tabs } from "@/components/ui/primitives";
import { cn, formatMoney, formatPercent, formatRelative, moveTone } from "@/lib/format";
import { toYahooSymbol } from "@/lib/market/symbols";
import { useQuotes } from "@/lib/market/use-quotes";
import { deleteList } from "@/lib/watchlist/actions";
import { listPnl } from "@/lib/watchlist/pnl";
import type { WatchlistSummary } from "@/lib/watchlist/types";
import { NewBasketButton } from "./new-basket-button";

export function ListsView({
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

  const { quotes } = useQuotes(allSymbols);

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

      <Section>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 bg-sunken">
          <Tabs
            active={tab}
            onChange={setTab}
            tabs={[
              { id: "mine", label: "Your baskets", count: mine.length },
              { id: "public", label: "Public", count: shared.length },
            ]}
          />
          <TotalsStrip totals={totals} />
        </div>
      </Section>

      <Section flush>
        {sorted.length ? (
          <ListTable lists={sorted} quotes={quotes} showOwner={tab === "public"} />
        ) : (
          <EmptyState icon={<IconWatchlist className="size-5" />} title="Nothing here yet">
            {tab === "mine"
              ? "Create a basket to get started."
              : "No one has shared a public basket yet."}
          </EmptyState>
        )}
      </Section>
    </div>
  );
}

/**
 * The page's totals, on one line rather than in a band of four figures. The
 * band was taller than the table it introduced and read as empty whenever a
 * basket had no priced symbols yet.
 */
function TotalsStrip({ totals }: { totals: ReturnType<typeof listPnl> }) {
  if (totals.marketValue === null && totals.invested === null) return null;

  return (
    <dl className="flex flex-wrap items-baseline gap-x-5 gap-y-1 px-6 py-3 text-body">
      <div className="flex items-baseline gap-2">
        <dt className="text-meta text-ink-muted">Total value</dt>
        <dd className="font-serif text-lead tabular-nums text-ink">
          {totals.marketValue === null ? "—" : formatMoney(totals.marketValue)}
        </dd>
      </div>
      <div className="flex items-baseline gap-2">
        <dt className="text-meta text-ink-muted">Invested</dt>
        <dd className="tabular-nums text-ink-muted">
          {totals.invested === null ? "—" : formatMoney(totals.invested)}
        </dd>
      </div>
      <div className="flex items-baseline gap-2">
        <dt className="text-meta text-ink-muted">Total gain</dt>
        <dd
          className={cn(
            "tabular-nums",
            totals.unrealised === null ? "text-ink-muted" : moveTextClass(totals.unrealised),
          )}
        >
          {totals.unrealised === null ? "—" : formatMoney(totals.unrealised)}
          {totals.returnPct !== null ? (
            <span className="ml-1.5 text-detail opacity-80">
              {formatPercent(totals.returnPct)}
            </span>
          ) : null}
        </dd>
      </div>
    </dl>
  );
}

function ListTable({
  lists,
  quotes,
  showOwner,
}: {
  lists: WatchlistSummary[];
  quotes: ReturnType<typeof useQuotes>["quotes"];
  showOwner: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-225 border-collapse text-body">
        <thead>
          <tr className="border-b border-line bg-sunken text-meta text-ink-muted">
            <th className="px-3 py-2.5 pl-6 text-left font-medium">Basket</th>
            <th className="px-3 py-2.5 text-left font-medium">Description</th>
            <th className="px-3 py-2.5 text-right font-medium">Stocks</th>
            <th className="px-3 py-2.5 text-right font-medium">Struck</th>
            {showOwner ? <th className="px-3 py-2.5 text-right font-medium">By</th> : null}
            <th className="px-3 py-2.5 text-right font-medium">Value</th>
            <th className="px-3 py-2.5 text-right font-medium">Gain / loss</th>
            <th className="px-3 py-2.5 pr-6 text-right font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {lists.map((list) => (
            <ListRow key={list.id} list={list} quotes={quotes} showOwner={showOwner} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ListRow({
  list,
  quotes,
  showOwner,
}: {
  list: WatchlistSummary;
  quotes: ReturnType<typeof useQuotes>["quotes"];
  showOwner: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const pnl = listPnl(list.items, quotes);
  const href = `/watchlist/${list.id}`;

  function onDelete() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    startTransition(async () => {
      await deleteList(list.id);
    });
  }

  return (
    // Rows alternate against the canvas so the eye can track one across eight
    // columns — a hairline alone was not enough separation on a dark ground.
    <tr
      className={cn(
        "border-b border-line last:border-b-0 odd:bg-sunken/60 hover:bg-accent-soft/40",
        pending && "opacity-50",
      )}
    >
      <td className="px-3 py-3 pl-6">
        <Link href={href} className="flex items-center gap-2">
          <span className="font-medium text-ink">{list.name}</span>
          {list.visibility === "public" ? <Badge tone="accent">Public</Badge> : null}
        </Link>
      </td>
      <td className="px-3 py-3 text-left text-detail text-ink-muted">
        <Link href={href} className="block max-w-[36ch] truncate">
          {list.description ?? <span className="text-ink-subtle">—</span>}
        </Link>
      </td>
      <td className="px-3 py-3 text-right tabular-nums text-ink-muted">{list.items.length}</td>
      <td className="px-3 py-3 text-right tabular-nums text-ink-muted">
        <div>{new Date(list.createdAt).toLocaleDateString()}</div>
        <div className="text-meta text-ink-subtle">{formatRelative(list.createdAt)}</div>
      </td>
      {showOwner ? (
        <td className="px-3 py-3 text-right">
          <Badge tone={list.createdBy === "agent" ? "info" : "neutral"}>
            {list.createdBy === "agent" ? "Agent" : "Member"}
          </Badge>
        </td>
      ) : null}
      <td className="px-3 py-3 text-right tabular-nums text-ink">
        {pnl.marketValue === null ? "—" : formatMoney(pnl.marketValue)}
        {pnl.pricedCount > 0 && pnl.pricedCount < pnl.count ? (
          <div className="text-meta text-ink-subtle">
            {pnl.pricedCount} of {pnl.count} priced
          </div>
        ) : null}
      </td>
      <td
        className={cn(
          "px-3 py-3 text-right tabular-nums",
          pnl.unrealised === null ? "text-ink-muted" : moveTextClass(pnl.unrealised),
        )}
      >
        {pnl.unrealised === null ? "—" : formatMoney(pnl.unrealised)}
        {pnl.returnPct !== null ? (
          <div className="text-meta opacity-80">{formatPercent(pnl.returnPct)}</div>
        ) : null}
      </td>
      <td className="px-3 py-3 pr-6 text-right">
        {list.isOwner ? (
          <button
            type="button"
            onClick={onDelete}
            onBlur={() => setConfirming(false)}
            disabled={pending}
            className={cn(
              "text-meta whitespace-nowrap",
              confirming ? "font-medium text-loss" : "text-ink-subtle hover:text-loss",
            )}
          >
            {confirming ? "Confirm delete" : "Delete"}
          </button>
        ) : null}
      </td>
    </tr>
  );
}

function moveTextClass(n: number): string {
  const tone = moveTone(n);
  return tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : "text-ink-muted";
}
