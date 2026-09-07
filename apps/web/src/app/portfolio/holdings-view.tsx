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
  Tabs,
} from "@/components/ui/primitives";
import { ConnectZerodhaButton } from "@/components/zerodha/connect-button";
import { cn, formatMoney, formatPercent, formatRelative, moveTone } from "@/lib/format";
import {
  summarise,
  summariseMf,
  type KiteHolding,
  type KiteMfHolding,
} from "@/lib/zerodha/types";
import { useKiteCallback } from "@/lib/zerodha/use-callback";
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
  // Zerodha may land the login here rather than on /zerodha/callback, depending
  // on which path the Kite app has registered. Finish it either way.
  const callback = useKiteCallback();

  // One pull per visit. Prices only matter as of when you look at them, and the
  // effect re-runs when `refresh` changes identity, i.e. when the token changes.
  useEffect(() => {
    if (connected) void refresh();
  }, [connected, refresh]);

  if (!connected) {
    return (
      <div className="bg-canvas">
        <PageHeader
          title="Portfolio"
          subtitle="Every position you hold, what it cost, and what it is worth now."
          actions={callback.status === "working" ? null : <ConnectZerodhaButton />}
        />
        <Section flush>
          {callback.status === "working" ? (
            <EmptyState title="Connecting to Zerodha">
              Finishing the handshake and reading your holdings. This takes a second.
            </EmptyState>
          ) : callback.status === "error" ? (
            <EmptyState
              icon={<IconPortfolio className="size-5" />}
              title="Zerodha connection failed"
              action={<ConnectZerodhaButton label="Try again" />}
            >
              {callback.error}
            </EmptyState>
          ) : notConfigured ? (
            <EmptyState
              icon={<IconPortfolio className="size-5" />}
              title="Zerodha is not configured"
            >
              This build has no Kite credentials. Create an app at developers.kite.trade,
              set its redirect URL to <code className="text-ink">/zerodha/callback</code>,
              and put <code className="text-ink">KITE_API_KEY</code> and{" "}
              <code className="text-ink">KITE_API_SECRET</code> in{" "}
              <code className="text-ink">apps/web/.env.local</code>.
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
    <div className="bg-canvas">
      <PageHeader
        title="Portfolio"
        subtitle={
          <>
            Connected to Zerodha as{" "}
            <span className="text-ink">
              {connection?.session.user_name ?? connection?.session.user_id}
            </span>
            {" · book "}
            <span className="text-ink tabular-nums">{formatMoney(bookValue)}</span>
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
          <div className="flex flex-wrap items-center gap-3 px-6 py-3 text-detail text-loss">
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
              <div className="px-6 py-3 text-detail text-warn">
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

/** Which side of the book is on screen. The tab strip itself lives in primitives. */
type TabId = "equity" | "mf";

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
          <tr className="border-b border-line text-meta text-ink-muted">
            <Th left>Symbol</Th>
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
                className="border-b border-line last:border-b-0 hover:bg-sunken"
              >
                <Td left>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink">{h.tradingsymbol}</span>
                    <Badge mono>{h.exchange}</Badge>
                    {h.t1_quantity > 0 ? <Badge tone="info">T1</Badge> : null}
                  </div>
                </Td>
                <Td>{qty}</Td>
                <Td>{formatMoney(h.average_price)}</Td>
                <Td>{formatMoney(h.last_price)}</Td>
                <Td className="text-ink">{formatMoney(qty * h.last_price)}</Td>
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
          <tr className="border-b border-line text-meta text-ink-muted">
            <Th left>Fund</Th>
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
              className="border-b border-line last:border-b-0 hover:bg-sunken"
            >
              <Td left>
                <div className="max-w-[42ch] font-medium text-ink">{h.fund}</div>
                {h.folio ? (
                  <div className="mt-0.5 font-mono text-meta text-ink-subtle">
                    Folio {h.folio}
                  </div>
                ) : null}
              </Td>
              {/* Units are fractional — a fund sells you ₹5,000 worth, not 3 units. */}
              <Td>{h.quantity.toLocaleString("en-IN", { maximumFractionDigits: 3 })}</Td>
              <Td>{formatMoney(h.average_price)}</Td>
              <Td>{formatMoney(h.last_price)}</Td>
              <Td className="text-ink">{formatMoney(h.quantity * h.last_price)}</Td>
              <Td tone={moveTone(h.pnl)}>{formatMoney(h.pnl)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Figures are right-aligned so decimal points stack; the one label column is
 * left. Alignment is a prop rather than a class the caller passes, because
 * `cn("text-right", "text-left")` emits both and the winner is decided by the
 * order Tailwind wrote them into the stylesheet, not the order given here.
 */
function Th({ children, left }: { children: React.ReactNode; left?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        "px-3 py-2.5 font-medium tracking-wide first:pl-6 last:pr-6",
        left ? "text-left" : "text-right",
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className,
  tone,
  left,
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "gain" | "loss" | "neutral";
  left?: boolean;
}) {
  const color =
    tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : "text-ink-muted";
  return (
    <td
      className={cn(
        "px-3 py-3 tabular-nums first:pl-6 last:pr-6",
        left ? "text-left" : "text-right",
        color,
        className,
      )}
    >
      {children}
    </td>
  );
}
