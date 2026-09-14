/**
 * A book of holdings, whatever it came from.
 *
 * A basket someone struck and a broker portfolio are the same thing to every
 * reader of them — the dashboard, the brief, the analyst: a list of symbols with
 * quantities and a cost. Both are carried as a `WatchlistSummary`, and `kind`
 * says which, so the few places that must differ (where a brief is stored, what
 * the copy calls it) can ask rather than being written twice.
 */

import type { BookKind, WatchlistSummary } from "./types";

/** Where a book's brief and runs are filed. */
export interface BookRef {
  kind: BookKind;
  id: string;
}

export function bookRef(book: Pick<WatchlistSummary, "kind" | "id">): BookRef {
  return { kind: book.kind, id: book.id };
}

/** The column a brief or run row names its book by. */
export function subjectColumn(kind: BookKind): "watchlist_id" | "portfolio_id" {
  return kind === "portfolio" ? "portfolio_id" : "watchlist_id";
}

/** What the copy calls a book of this kind. */
export function bookNoun(kind: BookKind): "basket" | "portfolio" {
  return kind === "portfolio" ? "portfolio" : "basket";
}
