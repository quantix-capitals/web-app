import { PageHeader } from "@/components/shell/page-header";
import { IconWatchlist } from "@/components/shell/nav-icons";
import { ActionStyle, EmptyState, Section } from "@/components/ui/primitives";

export const metadata = { title: "Watchlist — Stealth Mode" };

/**
 * Names you are carrying but have not bought. Backed by `watchlists` /
 * `watchlist_items`; the agent scores these on every scan whether or not they
 * make the universe cut.
 */
export default function WatchlistPage() {
  return (
    <div className="console-ground">
      <PageHeader
        title="Watchlist"
        subtitle="Names you are following. The agent scores these on every scan, held or not."
        actions={
          <button type="button" className={ActionStyle()}>
            Add a symbol
          </button>
        }
      />

      <Section flush>
        <EmptyState
          icon={<IconWatchlist className="size-5" />}
          title="Your watchlist is empty"
          action={
            <button type="button" className={ActionStyle()}>
              Add your first symbol
            </button>
          }
        >
          Add a symbol and it stays in view: price, momentum score, and a note from the
          agent when something about it changes.
        </EmptyState>
      </Section>
    </div>
  );
}
