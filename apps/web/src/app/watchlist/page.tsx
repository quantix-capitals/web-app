import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { IconWatchlist } from "@/components/shell/nav-icons";
import { ActionStyle, EmptyState, Section } from "@/components/ui/primitives";
import { getCurrentUser } from "@/lib/supabase/server";
import { listSummaries, publicSummaries } from "@/lib/watchlist/queries";
import { ListsView } from "./lists-view";
import { NewBasketButton } from "./new-basket-button";

export const metadata = { title: "Watchlist — Stealth Mode" };

/**
 * Baskets you've struck, and the public ones others have shared. Backed by
 * `watchlists` / `watchlist_items`, priced live from Yahoo.
 */
export default async function WatchlistPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="bg-canvas">
        <PageHeader
          title="Watchlist"
          subtitle="Dated baskets of symbols, and whether they've made money since you struck them."
        />
        <Section flush>
          <EmptyState
            icon={<IconWatchlist className="size-5" />}
            title="Sign in to build a basket"
            action={
              <Link href="/profile" className={ActionStyle()}>
                Sign in
              </Link>
            }
          >
            A basket is a named, dated list of symbols with quantities — the way to test
            whether a set of picks, yours or the agent&apos;s, actually worked.
          </EmptyState>
        </Section>
      </div>
    );
  }

  const [mine, shared] = await Promise.all([listSummaries(), publicSummaries()]);

  if (mine.length === 0 && shared.length === 0) {
    return (
      <div className="bg-canvas">
        <PageHeader
          title="Watchlist"
          subtitle="Dated baskets of symbols, and whether they've made money since you struck them."
        />
        <Section flush>
          <EmptyState
            icon={<IconWatchlist className="size-5" />}
            title="Your watchlist is empty"
            action={<NewBasketButton label="Create your first basket" />}
          >
            A basket is a named, dated list of symbols with quantities — the way to test
            whether a set of picks, yours or the agent&apos;s, actually worked.
          </EmptyState>
        </Section>
      </div>
    );
  }

  return <ListsView mine={mine} shared={shared} />;
}
