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
}

export interface WatchlistSummary {
  id: string;
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
