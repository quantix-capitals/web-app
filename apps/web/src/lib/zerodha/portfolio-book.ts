/**
 * A Zerodha account, as a book.
 *
 * The portfolio page reads Kite's two holdings lists; the dashboard, the brief
 * and the analyst read a `WatchlistSummary`. This is the one adapter between
 * them, so everything built for baskets works on the portfolio unchanged.
 *
 * What goes in:
 *
 * - **Every equity holding**, at settled plus T1 quantity, with Kite's average
 *   price as the cost.
 * - **Equity mutual funds only**, identified by AMFI category (see
 *   `lib/market/funds.ts`). Debt, hybrid and commodity funds are left out and
 *   listed, so the page can say so.
 *
 * What cannot go in: purchase dates. Kite does not report them, so every item's
 * `entryAt` is null — the analyst says "held since" is unknown, and the
 * dashboard values today's holdings over a look-back window instead of since
 * entry.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { KiteMfHolding, ZerodhaConnection } from "@stealth/shared";
import { useAuth } from "@/context/auth-context";
import { FUND_EXCHANGE, fundCategoryLabel, isEquityFund } from "@/lib/market/funds";
import type { WatchlistItemView, WatchlistSummary } from "@/lib/watchlist/types";
import { fundSchemes } from "@/services/fund-service";
import { ensureBrokerPortfolio } from "@/services/portfolio-service";

export interface ExcludedFund {
  holding: KiteMfHolding;
  category: string | null;
}

export interface PortfolioBook {
  /** Null until the portfolio's record exists and the fund categories are known. */
  book: WatchlistSummary | null;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  /** Funds admitted as equity. */
  equityFunds: number;
  /** Funds left out, with the category that ruled them out. */
  excludedFunds: ExcludedFund[];
  /** Fund categories could not be read — funds are left out until they can be. */
  fundError: string | null;
}

export function usePortfolioBook(connection: ZerodhaConnection | null): PortfolioBook {
  const { user } = useAuth();
  const account = connection?.session.user_id ?? null;

  const record = useQuery({
    queryKey: ["portfolios", "zerodha", account],
    queryFn: () =>
      ensureBrokerPortfolio({
        broker: "zerodha",
        account: account!,
        name: `Zerodha ${account}`,
      }),
    enabled: Boolean(account && user),
    staleTime: Infinity,
    retry: 1,
  });

  const mf = useMemo(() => connection?.mf_holdings ?? [], [connection]);
  const isins = useMemo(
    () => [...new Set(mf.map((h) => h.tradingsymbol.toUpperCase()))].sort(),
    [mf],
  );

  const schemes = useQuery({
    queryKey: ["funds", "schemes", isins],
    queryFn: () => fundSchemes(isins),
    enabled: isins.length > 0,
    staleTime: 24 * 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
    retry: 1,
  });

  const built = useMemo(() => {
    if (!connection || !record.data) return null;

    const items: WatchlistItemView[] = [];

    for (const h of connection.holdings) {
      const quantity = h.quantity + h.t1_quantity;
      if (!(quantity > 0)) continue;
      items.push({
        id: `eq:${h.exchange}:${h.tradingsymbol}`,
        quantity,
        entryPrice: h.average_price > 0 ? h.average_price : null,
        entryAt: null,
        entrySource: null,
        addedAt: "",
        note: null,
        symbol: h.tradingsymbol.toUpperCase(),
        exchange: h.exchange.toUpperCase(),
        name: null,
        instrumentId: "",
      });
    }

    const excluded: ExcludedFund[] = [];
    let equityFunds = 0;
    for (const h of mf) {
      if (!(h.quantity > 0)) continue;
      const isin = h.tradingsymbol.toUpperCase();
      const scheme = schemes.data?.get(isin);
      const category = scheme?.category ?? null;
      if (!schemes.data || !isEquityFund(category, h.fund)) {
        excluded.push({ holding: h, category });
        continue;
      }
      equityFunds += 1;
      items.push({
        id: `mf:${h.folio ?? "-"}:${isin}`,
        quantity: h.quantity,
        entryPrice: h.average_price > 0 ? h.average_price : null,
        entryAt: null,
        entrySource: null,
        addedAt: "",
        note: null,
        symbol: isin,
        exchange: FUND_EXCHANGE,
        name: h.fund,
        instrumentId: "",
        sector: `Fund · ${fundCategoryLabel(category)}`,
      });
    }

    const book: WatchlistSummary = {
      id: record.data.id,
      kind: "portfolio",
      name: "Zerodha portfolio",
      description: connection.session.user_name
        ? `${connection.session.user_name}'s holdings at Zerodha`
        : "Holdings at Zerodha",
      createdBy: "user",
      visibility: "private",
      sourceScanId: null,
      sourceRunId: null,
      createdAt: record.data.createdAt,
      updatedAt: connection.synced_at ?? record.data.createdAt,
      isOwner: true,
      items,
    };

    return { book, excluded, equityFunds };
  }, [connection, record.data, mf, schemes.data]);

  // Funds wait on their categories; a book without them would count a debt fund
  // as equity for a moment and then drop it. Equity-only accounts do not wait.
  const waitingOnFunds = isins.length > 0 && schemes.isPending;

  return {
    book: waitingOnFunds ? null : (built?.book ?? null),
    status: record.isError
      ? "error"
      : !account || !user
        ? "idle"
        : built && !waitingOnFunds
          ? "ready"
          : "loading",
    error: record.isError
      ? record.error instanceof Error
        ? record.error.message
        : "Could not open this portfolio's record."
      : !user && account
        ? "Sign in to use the dashboard, brief and analyst on your portfolio."
        : null,
    equityFunds: built?.equityFunds ?? 0,
    excludedFunds: built?.excluded ?? [],
    fundError: schemes.isError
      ? `Could not read fund categories from mfapi.in, so funds are left out${
          schemes.error instanceof Error ? ` — ${schemes.error.message}` : ""
        }.`
      : null,
  };
}
