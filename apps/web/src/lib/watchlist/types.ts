import type { EntrySource, ListOrigin, ListVisibility } from "@/lib/types";

/** An item flattened with the instrument it points at. */
export interface WatchlistItemView {
  id: string;
  quantity: number;
  entryPrice: number | null;
  entryAt: string | null;
  entrySource: EntrySource | null;
  addedAt: string;
  note: string | null;
  symbol: string;
  exchange: string;
  name: string | null;
  instrumentId: string;
  /**
   * A sector or fund category the source already knows — a mutual fund's AMFI
   * category, say — for holdings the sector lookup table would not recognise.
   */
  sector?: string | null;
}

/** What a book of holdings is: a basket someone struck, or a broker portfolio. */
export type BookKind = "watchlist" | "portfolio";

export interface WatchlistSummary {
  id: string;
  kind: BookKind;
  name: string;
  description: string | null;
  createdBy: ListOrigin;
  visibility: ListVisibility;
  sourceScanId: string | null;
  sourceRunId: string | null;
  createdAt: string;
  updatedAt: string;
  isOwner: boolean;
  items: WatchlistItemView[];
}
