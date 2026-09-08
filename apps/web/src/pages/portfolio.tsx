import { useSearchParams } from "react-router-dom";
import { Suspense, useEffect, useState } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { IconPortfolio } from "@/components/shell/nav-icons";
import {
  ActionStyle,
  Badge,
  EmptyState,
  SECTION_X,
  Section,
  SectionHeader,
  Stat,
  StatBand,
  SymbolLink,
  Tabs,
} from "@/components/ui/primitives";
import { ConnectZerodhaButton } from "@/components/zerodha/connect-button";
import { cn, formatMoney, formatPercent, formatRelative, moveTone } from "@/lib/format";
import {
  mfUnrealised,
  summarise,
  summariseMf,
  type KiteHolding,
  type KiteMfHolding,
} from "@stealth/shared";
import { useKiteCallback } from "@/lib/zerodha/use-callback";
import { useZerodha } from "@/lib/zerodha/use-connection";

/**
 * The book, read from Zerodha. Everything on this page comes out of localStorage
 * (see `lib/zerodha/local-store`) — no Supabase round trip yet — and is refreshed
 * through the server-side Kite proxy on mount.
 */
export function Portfolio() {
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
  const notConfigured = useSearchParams()[0].get("zerodha") === "not-configured";
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
              The <code className="text-ink">zerodha</code> function has no Kite
              credentials. Create an app at developers.kite.trade, set its redirect URL
              to <code className="text-ink">/zerodha/callback</code>, then set{" "}
              <code className="text-ink">KITE_API_KEY</code> and{" "}
              <code className="text-ink">KITE_API_SECRET</code> as edge function secrets
              — they sign the session checksum, so they can never reach this page.
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
            <span className="block">
              Connected to Zerodha as{" "}
              <span className="text-ink">
                {connection?.session.user_name ?? connection?.session.user_id}
              </span>
              {connection?.synced_at ? ` · synced ${formatRelative(connection.synced_at)}` : null}
            </span>
            <span className="mt-0.5 block">
              Combined book (equity + funds):{" "}
              <span className="text-ink tabular-nums">{formatMoney(bookValue)}</span>
            </span>
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

      <Section className="bg-sunken">
        <StatBand>
          <Stat label="Market value" value={formatMoney(totals.marketValue)} />
          <Stat
            label="Invested"
            value={formatMoney(totals.invested)}
            hint="Cost basis across open positions"
          />
          <Stat
            label="Unrealised P&L"
            value={formatMoney(totals.unrealised, true)}
            hint={formatPercent(investedPct)}
            tone={moveTone(totals.unrealised)}
          />
          {/* A fund has no intraday mark, so the slot holds an em-dash rather than
              a zero that would read as "flat today". */}
          <Stat
            label="Day change"
            value={totals.dayChange === null ? "—" : formatMoney(totals.dayChange, true)}
            hint={
              totals.dayChange === null
                ? "Funds are priced once a day"
                : "Against the previous close"
            }
            tone={totals.dayChange === null ? "neutral" : moveTone(totals.dayChange)}
          />
        </StatBand>
        {bookValue > 0 ? (
          <AllocationBar equity={equityTotals.marketValue} mf={mfTotals.marketValue} />
        ) : null}
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

/**
 * Equity vs mutual funds, as a single stacked bar rather than a two-slice
 * donut — a part-to-whole of exactly two categories reads faster as one bar
 * split in two than as a circle. The 2px gaps between and around the fill are
 * the surrounding `bg-sunken` showing through, not drawn borders. Neither
 * segment touches gain/loss — those colors are reserved for signed P&L, so
 * identity here comes from the accent (equity) against a neutral (funds).
 */
function AllocationBar({ equity, mf }: { equity: number; mf: number }) {
  const total = equity + mf;
  if (total <= 0) return null;
  const equityPct = (equity / total) * 100;
  const mfPct = 100 - equityPct;
  const share = (n: number) => `${((n / total) * 100).toFixed(1)}%`;

  return (
    <div className={cn(SECTION_X, "flex flex-col gap-2 pb-5")}>
      <div
        role="img"
        aria-label={`Allocation: ${share(equity)} equity, ${share(mf)} mutual funds`}
        className="flex h-2.5 w-full gap-0.5"
      >
        {equityPct > 0 ? <div className="h-full bg-accent" style={{ width: `${equityPct}%` }} /> : null}
        {mfPct > 0 ? <div className="h-full bg-ink-subtle" style={{ width: `${mfPct}%` }} /> : null}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-detail text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2 shrink-0 bg-accent" />
          Equity <span className="text-ink tabular-nums">{formatMoney(equity)}</span>
          <span className="text-ink-subtle">{share(equity)}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2 shrink-0 bg-ink-subtle" />
          Mutual funds <span className="text-ink tabular-nums">{formatMoney(mf)}</span>
          <span className="text-ink-subtle">{share(mf)}</span>
        </span>
      </div>
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
                className="border-b border-line last:border-b-0 odd:bg-sunken/60 hover:bg-accent-soft/40"
              >
                <Td left accent={moveTone(h.pnl)}>
                  <div className="flex items-center gap-2">
                    <SymbolLink
                      symbol={h.tradingsymbol}
                      exchange={h.exchange}
                      className="font-medium text-ink"
                    />
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
                <Td tone={moveTone(h.pnl)}>{formatMoney(h.pnl, true)}</Td>
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
          {rows.map((h) => {
            const pnl = mfUnrealised(h);
            const invested = h.quantity * h.average_price;
            return (
              <tr
                key={`${h.folio ?? "—"}:${h.tradingsymbol}`}
                className="border-b border-line last:border-b-0 odd:bg-sunken/60 hover:bg-accent-soft/40"
              >
                <Td left accent={moveTone(pnl)}>
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
                <Td tone={moveTone(pnl)}>
                  {formatMoney(pnl, true)}
                  {/* A return is only meaningful against what was put in. */}
                  {invested > 0 ? (
                    <div className="mt-0.5 text-meta opacity-80">
                      {formatPercent(pnl / invested)}
                    </div>
                  ) : null}
                </Td>
              </tr>
            );
          })}
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

const ROW_ACCENT: Record<"gain" | "loss" | "neutral", string> = {
  gain: "border-l-gain",
  loss: "border-l-loss",
  neutral: "border-l-transparent",
};

function Td({
  children,
  className,
  tone,
  left,
  accent,
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "gain" | "loss" | "neutral";
  left?: boolean;
  /** A 2px rule on the identity cell, so a row's direction registers before
   * its digits do. */
  accent?: "gain" | "loss" | "neutral";
}) {
  const color =
    tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : "text-ink-muted";
  return (
    <td
      className={cn(
        "px-3 py-3 tabular-nums first:pl-6 last:pr-6",
        left ? "text-left" : "text-right",
        accent && "border-l-2",
        accent && ROW_ACCENT[accent],
        color,
        className,
      )}
    >
      {children}
    </td>
  );
}
