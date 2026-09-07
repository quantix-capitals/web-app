"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { IconWatchlist } from "@/components/shell/nav-icons";
import { Badge, EmptyState, Section, StatInline, Tabs } from "@/components/ui/primitives";
import { HeadRow, Sub, Table, Td, Th, Tr, RowAction } from "@/components/ui/table";
import { cn, formatDate, formatMoney, formatPercent, formatRelative, moveTone } from "@/lib/format";
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

      {/* Tabs and totals share one band, but not one baseline: the tabs sit on
          the rule they underline, and the figures are centred against them. */}
      <Section>
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-2 bg-sunken pr-6">
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

      <Section flush>
        {sorted.length ? (
          <ListTable lists={sorted} quotes={quotes} showOwner={tab === "public"} />
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
      className="py-2.5"
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
          label: "Total gain",
          value: totals.unrealised === null ? "—" : formatMoney(totals.unrealised, true),
          hint: totals.returnPct === null ? undefined : formatPercent(totals.returnPct),
          tone: totals.unrealised === null ? "neutral" : moveTone(totals.unrealised),
        },
      ]}
    />
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
    <Table minWidth="min-w-225">
      <HeadRow>
        <Th align="left" first>
          Basket
        </Th>
        <Th align="left">Description</Th>
        <Th>Stocks</Th>
        <Th>Struck</Th>
        {showOwner ? <Th>By</Th> : null}
        <Th>Value</Th>
        <Th>Gain / loss</Th>
        <Th last srOnly>
          Actions
        </Th>
      </HeadRow>
      <tbody>
        {lists.map((list) => (
          <ListRow key={list.id} list={list} quotes={quotes} showOwner={showOwner} />
        ))}
      </tbody>
    </Table>
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
    <Tr dimmed={pending}>
      <Td align="left" first>
        <Link href={href} className="flex items-center gap-2">
          <span className="font-medium text-ink">{list.name}</span>
          {list.visibility === "public" ? <Badge tone="accent">Public</Badge> : null}
        </Link>
      </Td>
      <Td align="left" className="text-detail text-ink-muted">
        <Link href={href} className="block max-w-[36ch] truncate">
          {list.description ?? <span className="text-ink-subtle">—</span>}
        </Link>
      </Td>
      <Td className="text-ink-muted">{list.items.length}</Td>
      <Td className="text-ink-muted">
        {formatDate(list.createdAt)}
        <Sub>{formatRelative(list.createdAt)}</Sub>
      </Td>
      {showOwner ? (
        <Td>
          <Badge tone={list.createdBy === "agent" ? "info" : "neutral"}>
            {list.createdBy === "agent" ? "Agent" : "Member"}
          </Badge>
        </Td>
      ) : null}
      <Td className="text-ink">
        {pnl.marketValue === null ? "—" : formatMoney(pnl.marketValue)}
        {pnl.pricedCount > 0 && pnl.pricedCount < pnl.count ? (
          <Sub>
            {pnl.pricedCount} of {pnl.count} priced
          </Sub>
        ) : null}
      </Td>
      <Td className={pnl.unrealised === null ? "text-ink-muted" : moveTextClass(pnl.unrealised)}>
        {pnl.unrealised === null ? "—" : formatMoney(pnl.unrealised, true)}
        {pnl.returnPct !== null ? (
          <Sub className={cn("opacity-80", moveTextClass(pnl.unrealised ?? 0))}>
            {formatPercent(pnl.returnPct)}
          </Sub>
        ) : null}
      </Td>
      <Td last>
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

function moveTextClass(n: number): string {
  const tone = moveTone(n);
  return tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : "text-ink-muted";
}
