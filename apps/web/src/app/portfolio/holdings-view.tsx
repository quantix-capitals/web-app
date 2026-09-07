"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { IconPortfolio } from "@/components/shell/nav-icons";
import {
  ActionStyle,
  Badge,
  EmptyState,
  Section,
  SectionHeader,
  Stat,
  StatBand,
} from "@/components/ui/primitives";
import { ConnectZerodhaButton } from "@/components/zerodha/connect-button";
import { cn, formatMoney, formatPercent, formatRelative, moveTone } from "@/lib/format";
import {
  summarise,
  summariseMf,
  type KiteHolding,
  type KiteMfHolding,
} from "@/lib/zerodha/types";
import { useZerodha } from "@/lib/zerodha/use-connection";

/**
 * The book, read from Zerodha. Everything on this page comes out of localStorage
 * (see `lib/zerodha/local-store`) — no Supabase round trip yet — and is refreshed
 * through the server-side Kite proxy on mount.
 */
export function HoldingsView() {
  return (
    <Suspense fallback={null}>
      <Book />
    </Suspense>
  );
}

function Book() {
  const { connection, connected, syncing, error, expired, mfError, refresh, disconnect } =
    useZerodha();
  const [tab, setTab] = useState<TabId>("equity");
  // Set by `/api/zerodha/login` when the Kite keys are missing from the env.
  const notConfigured = useSearchParams().get("zerodha") === "not-configured";

  // One pull per visit. Prices only matter as of when you look at them, and the
  // effect re-runs when `refresh` changes identity, i.e. when the token changes.
  useEffect(() => {
    if (connected) void refresh();
  }, [connected, refresh]);

  if (!connected) {
    return (
      <div className="console-ground">
        <PageHeader
          title="Portfolio"
          subtitle="Every position you hold, what it cost, and what it is worth now."
          actions={<ConnectZerodhaButton />}
        />
        <Section flush>
          {notConfigured ? (
            <EmptyState
              icon={<IconPortfolio className="size-5" />}
              title="Zerodha is not configured"
            >
              This build has no Kite credentials. Create an app at developers.kite.trade,
              set its redirect URL to <code className="text-base-300">/zerodha/callback</code>,
              and put <code className="text-base-300">KITE_API_KEY</code> and{" "}
              <code className="text-base-300">KITE_API_SECRET</code> in{" "}
              <code className="text-base-300">apps/web/.env.local</code>.
            </EmptyState>
          ) : (
            <EmptyState
              icon={<IconPortfolio className="size-5" />}
              title="No holdings yet"
              action={<ConnectZerodhaButton label="Connect Zerodha" />}
            >
              Connect your Zerodha account and the desk reads your holdings straight from
              Kite — symbol, quantity, average cost, and today&apos;s move. Your session
              stays in this browser for now; nothing is saved to a server.
            </EmptyState>
          )}
        </Section>
      </div>
    );
  }

  const holdings = connection?.holdings ?? [];
  const mfHoldings = connection?.mf_holdings ?? [];

  const equityTotals = summarise(holdings);
  const mfTotals = summariseMf(mfHoldings);
  const totals = tab === "equity" ? equityTotals : mfTotals;
  const investedPct = totals.invested ? totals.unrealised / totals.invested : 0;
  // The whole book, so switching tabs never hides what everything is worth.
  const bookValue = equityTotals.marketValue + mfTotals.marketValue;

  return (
    <div className="console-ground">
      <PageHeader
        title="Portfolio"
        subtitle={
          <>
            Connected to Zerodha as{" "}
            <span className="text-base-300">
              {connection?.session.user_name ?? connection?.session.user_id}
            </span>
            {" · book "}
            <span className="text-base-300 tabular-nums">{formatMoney(bookValue)}</span>
            {connection?.synced_at ? ` · synced ${formatRelative(connection.synced_at)}` : null}
          </>
        }
        actions={
          <>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={syncing}
              className={cn(ActionStyle({ variant: "ghost" }), syncing && "opacity-60")}
            >
              {syncing ? "Syncing…" : "Refresh"}
            </button>
            <button
              type="button"
              onClick={disconnect}
              className={ActionStyle({ variant: "ghost" })}
            >
              Disconnect
            </button>
          </>
        }
      />

      {error ? (
        <Section>
          <div className="flex flex-wrap items-center gap-3 px-6 py-3 text-detail text-danger-400">
            <span>{error}</span>
            {expired ? (
              <ConnectZerodhaButton variant="ghost" label="Reconnect" className="py-1" />
            ) : null}
          </div>
        </Section>
      ) : null}

      <Section>
        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { id: "equity", label: "Equity", count: equityTotals.count },
            { id: "mf", label: "Mutual funds", count: mfTotals.count },
          ]}
        />
      </Section>

      <Section>
        <StatBand>
          <Stat label="Market value" value={formatMoney(totals.marketValue)} />
          <Stat
            label="Invested"
            value={formatMoney(totals.invested)}
            hint="Cost basis across open positions"
          />
          <Stat
            label="Unrealised P&L"
            value={formatMoney(totals.unrealised)}
            hint={formatPercent(investedPct)}
            tone={moveTone(totals.unrealised)}
          />
          {/* A fund has no intraday mark, so the slot holds an em-dash rather than
              a zero that would read as "flat today". */}
          <Stat
            label="Day change"
            value={totals.dayChange === null ? "—" : formatMoney(totals.dayChange)}
            hint={
              totals.dayChange === null
                ? "Funds are priced once a day"
                : "Against the previous close"
            }
            tone={totals.dayChange === null ? "neutral" : moveTone(totals.dayChange)}
          />
        </StatBand>
      </Section>

      <Section flush>
        {tab === "equity" ? (
          <>
            <SectionHeader
              title="Equity holdings"
              subtitle={`${equityTotals.count} ${equityTotals.count === 1 ? "position" : "positions"} held at Zerodha.`}
            />
            {holdings.length ? (
              <HoldingsTable holdings={holdings} />
            ) : (
              <EmptyState icon={<IconPortfolio className="size-5" />} title="Nothing held">
                Zerodha reports no equity holdings on this account.
              </EmptyState>
            )}
          </>
        ) : (
          <>
            <SectionHeader
              title="Mutual funds"
              subtitle={`${mfTotals.count} ${mfTotals.count === 1 ? "fund" : "funds"} held through Coin.`}
            />
            {mfError ? (
              <div className="px-6 py-3 text-detail text-warn-500">
                Equity loaded, but Zerodha did not return mutual funds: {mfError}
              </div>
            ) : null}
            {mfHoldings.length ? (
              <MfTable holdings={mfHoldings} />
            ) : (
              <EmptyState icon={<IconPortfolio className="size-5" />} title="No funds held">
                Zerodha reports no mutual fund holdings on this account.
              </EmptyState>
            )}
          </>
        )}
      </Section>
    </div>
  );
}

// --- Tabs -------------------------------------------------------------------

type TabId = "equity" | "mf";

/**
 * Two views of the same book. A tab strip rather than a switch: these are peers,
 * not an on/off state, and there is room for a third asset class later.
 */
function Tabs({
  active,
  onChange,
  tabs,
}: {
  active: TabId;
  onChange: (id: TabId) => void;
  tabs: Array<{ id: TabId; label: string; count: number }>;
}) {
  return (
    <div role="tablist" className="flex items-center gap-1 px-6 py-2">
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={on}
            type="button"
            onClick={() => onChange(t.id)}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-body font-medium transition",
              on
                ? "bg-base-850 text-base-100"
                : "text-base-500 hover:bg-base-900 hover:text-base-300",
            )}
          >
            {t.label}
            <Badge tone={on ? "ember" : "neutral"} mono>
              {t.count}
            </Badge>
          </button>
        );
      })}
    </div>
  );
}

function HoldingsTable({ holdings }: { holdings: KiteHolding[] }) {
  // Biggest position first — the number that moves the book most should be read
  // first, and Kite returns them in whatever order its ledger holds.
  const rows = [...holdings].sort(
    (a, b) =>
      (b.quantity + b.t1_quantity) * b.last_price -
      (a.quantity + a.t1_quantity) * a.last_price,
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-body">
        <thead>
          <tr className="border-b border-base-850 text-meta uppercase tracking-[0.08em] text-base-500">
            <Th className="text-left">Symbol</Th>
            <Th>Qty</Th>
            <Th>Avg cost</Th>
            <Th>Last price</Th>
            <Th>Value</Th>
            <Th>Day</Th>
            <Th>P&L</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((h) => {
            const qty = h.quantity + h.t1_quantity;
            return (
              <tr
                key={`${h.exchange}:${h.tradingsymbol}`}
                className="border-b border-base-850 last:border-b-0 hover:bg-base-900/60"
              >
                <Td className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-base-100">{h.tradingsymbol}</span>
                    <Badge mono>{h.exchange}</Badge>
                    {h.t1_quantity > 0 ? <Badge tone="info">T1</Badge> : null}
                  </div>
                </Td>
                <Td>{qty}</Td>
                <Td>{formatMoney(h.average_price)}</Td>
                <Td>{formatMoney(h.last_price)}</Td>
                <Td className="text-base-100">{formatMoney(qty * h.last_price)}</Td>
                <Td tone={moveTone(h.day_change)}>
                  {formatPercent(h.day_change_percentage / 100)}
                </Td>
                <Td tone={moveTone(h.pnl)}>{formatMoney(h.pnl)}</Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Funds, biggest first. Different columns from equity on purpose: units carry
 * fractions, the price is a NAV, and there is no intraday move to show.
 */
function MfTable({ holdings }: { holdings: KiteMfHolding[] }) {
  const rows = [...holdings].sort(
    (a, b) => b.quantity * b.last_price - a.quantity * a.last_price,
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-body">
        <thead>
          <tr className="border-b border-base-850 text-meta uppercase tracking-[0.08em] text-base-500">
            <Th className="text-left">Fund</Th>
            <Th>Units</Th>
            <Th>Avg NAV</Th>
            <Th>Last NAV</Th>
            <Th>Value</Th>
            <Th>P&L</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((h) => (
            <tr
              key={`${h.folio ?? "—"}:${h.tradingsymbol}`}
              className="border-b border-base-850 last:border-b-0 hover:bg-base-900/60"
            >
              <Td className="text-left">
                <div className="max-w-[42ch] font-medium text-base-100">{h.fund}</div>
                {h.folio ? (
                  <div className="mt-0.5 font-mono text-meta text-base-600">
                    Folio {h.folio}
                  </div>
                ) : null}
              </Td>
              {/* Units are fractional — a fund sells you ₹5,000 worth, not 3 units. */}
              <Td>{h.quantity.toLocaleString("en-IN", { maximumFractionDigits: 3 })}</Td>
              <Td>{formatMoney(h.average_price)}</Td>
              <Td>{formatMoney(h.last_price)}</Td>
              <Td className="text-base-100">{formatMoney(h.quantity * h.last_price)}</Td>
              <Td tone={moveTone(h.pnl)}>{formatMoney(h.pnl)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cn("px-3 py-2 text-right font-medium first:pl-6 last:pr-6", className)}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className,
  tone,
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "ok" | "danger" | "neutral";
}) {
  const color =
    tone === "ok" ? "text-ok-400" : tone === "danger" ? "text-danger-400" : "text-base-300";
  return (
    <td
      className={cn(
        "px-3 py-2.5 text-right tabular-nums first:pl-6 last:pr-6",
        color,
        className,
      )}
    >
      {children}
    </td>
  );
}
