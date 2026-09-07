import Link from "next/link";
import { Hero } from "@/components/hero/hero";
import { IconMomentum, IconPortfolio, IconWatchlist } from "@/components/shell/nav-icons";
import {
  ActionStyle,
  Empty,
  Section,
  SectionHeader,
  SplitGrid,
  Stat,
  StatBand,
} from "@/components/ui/primitives";

/**
 * The desk. Every figure here reads em-dash until the Supabase queries land — a
 * zero would be a claim about the book, and this page has not asked it anything
 * yet. See `lib/supabase/server.ts`.
 */
export default function OverviewPage() {
  return (
    <div>
      <Hero
        eyebrow="Nothing connected yet"
        title="Momentum, found and managed."
        actions={
          <>
            <Link href="/momentum" className={ActionStyle()}>
              <IconMomentum className="size-4" />
              Run a momentum scan
            </Link>
            <Link href="/portfolio" className={ActionStyle({ variant: "ghost" })}>
              Set up your portfolio
            </Link>
          </>
        }
      >
        The agent ranks the market on momentum, tells you what changed since
        yesterday, and keeps watch over the positions you already hold.
      </Hero>

      <Section>
        <StatBand>
          <Stat label="Book value" value="—" hint="Across all portfolios" />
          <Stat label="Day change" value="—" hint="Unrealised, since previous close" />
          <Stat label="Open positions" value="—" hint="Held across the book" />
          <Stat label="Live signals" value="—" hint="From the latest scan" />
        </StatBand>
      </Section>

      <Section>
        <SplitGrid cols={2}>
          <div>
            <SectionHeader
              title="Top movers in your book"
              subtitle="The positions doing the most to today's number, in either direction."
            />
            <Empty inline>
              No positions yet. Add holdings on{" "}
              <Link href="/portfolio" className="text-ember-400 hover:text-ember-300">
                Portfolio
              </Link>{" "}
              and this fills in on the next price refresh.
            </Empty>
          </div>
          <div>
            <SectionHeader
              title="Fresh momentum"
              subtitle="Names the last scan ranked highest that you do not already hold."
            />
            <Empty inline>
              The agent has not run a scan yet. Start one from{" "}
              <Link href="/momentum" className="text-ember-400 hover:text-ember-300">
                Momentum
              </Link>
              .
            </Empty>
          </div>
        </SplitGrid>
      </Section>

      <Section flush>
        <SectionHeader
          title="Agent activity"
          subtitle="Every scan and review the agent has run, most recent first."
          right={
            <Link href="/momentum" className="text-meta text-base-500 hover:text-base-200">
              View all
            </Link>
          }
        />
        <Empty inline>
          Nothing has run yet. Once the agent service is reachable, its runs stream in
          here — what it looked at, what it decided, and why.
        </Empty>
      </Section>

      {/* A quiet map of the product, for the first session where nothing is set up. */}
      <Section flush>
        <SplitGrid cols={3} className="border-t border-base-850">
          <StartCard
            href="/portfolio"
            icon={<IconPortfolio className="size-[18px]" />}
            title="Portfolio"
          >
            Your holdings, cost basis, and what the book is actually worth right now.
          </StartCard>
          <StartCard
            href="/watchlist"
            icon={<IconWatchlist className="size-[18px]" />}
            title="Watchlist"
          >
            Names you are carrying but have not bought. The agent watches these too.
          </StartCard>
          <StartCard
            href="/momentum"
            icon={<IconMomentum className="size-[18px]" />}
            title="Momentum"
          >
            Rank a universe on momentum and read the agent&apos;s case for each name.
          </StartCard>
        </SplitGrid>
      </Section>
    </div>
  );
}

function StartCard({
  href,
  icon,
  title,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="group block px-6 py-5 transition hover:bg-base-900/60">
      <div className="flex items-center gap-2.5 text-base-500 transition-colors group-hover:text-ember-400">
        {icon}
        <span className="text-body font-semibold text-base-200">{title}</span>
      </div>
      <p className="mt-2 text-detail leading-relaxed text-base-500">{children}</p>
    </Link>
  );
}
