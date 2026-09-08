import { Link } from "react-router-dom";
import { Hero } from "@/components/hero/hero";
import { IconMomentum, IconPortfolio, IconWatchlist } from "@/components/shell/nav-icons";
import { ConnectZerodhaButton } from "@/components/zerodha/connect-button";
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
export function Home() {
  return (
    <div>
      <Hero
        eyebrow="Nothing connected yet"
        title="Momentum, found and managed."
        actions={
          <>
            <ConnectZerodhaButton />
            <Link to="/momentum" className={ActionStyle({ variant: "ghost" })}>
              <IconMomentum className="size-4" />
              Run a momentum scan
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
              No positions yet. Connect Zerodha from{" "}
              <Link to="/portfolio" className="text-accent-ink underline decoration-line-strong underline-offset-2 hover:decoration-accent">
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
              <Link to="/momentum" className="text-accent-ink underline decoration-line-strong underline-offset-2 hover:decoration-accent">
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
            <Link to="/momentum" className="text-meta text-ink-muted hover:text-ink">
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
        <SplitGrid cols={3} className="border-t border-line">
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
    <Link to={href} className="group block px-6 py-5 transition hover:bg-sunken">
      <div className="flex items-center gap-2.5 text-ink-muted transition-colors group-hover:text-accent">
        {icon}
        <span className="text-body font-semibold text-ink">{title}</span>
      </div>
      <p className="mt-2 text-detail leading-relaxed text-ink-muted">{children}</p>
    </Link>
  );
}
