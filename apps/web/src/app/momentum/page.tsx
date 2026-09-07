import { PageHeader } from "@/components/shell/page-header";
import { IconAgent, IconMomentum } from "@/components/shell/nav-icons";
import {
  ActionStyle,
  Badge,
  Empty,
  EmptyState,
  Section,
  SectionHeader,
} from "@/components/ui/primitives";

export const metadata = { title: "Momentum — Stealth Mode" };

/**
 * Where the agent is put to work. A scan writes a `momentum_scans` row and streams
 * `momentum_signals` into it; this page is the read side plus the button that
 * starts one. The agent itself is a separate service — see `apps/agent` and
 * `lib/agent/client.ts`.
 */
export default function MomentumPage() {
  return (
    <div className="bg-canvas">
      <PageHeader
        title="Momentum analysis"
        subtitle="Rank a universe on momentum, and read the agent's case for each name it surfaces."
        actions={
          <button type="button" className={ActionStyle()}>
            <IconAgent className="size-4" />
            Run a scan
          </button>
        }
      />

      <Section>
        <SectionHeader
          title="Latest scan"
          subtitle="The most recent ranking, and what moved in or out of it since the run before."
          right={<Badge tone="neutral">No runs</Badge>}
        />
        <Empty inline>
          The agent service is not connected yet. Point{" "}
          <code className="font-mono text-ink-muted">NEXT_PUBLIC_AGENT_URL</code> at it and
          this section fills with the ranking as it streams.
        </Empty>
      </Section>

      <Section flush>
        <EmptyState
          icon={<IconMomentum className="size-5" />}
          title="No scans yet"
          action={
            <button type="button" className={ActionStyle()}>
              <IconAgent className="size-4" />
              Run your first scan
            </button>
          }
        >
          A scan ranks a universe of stocks on price and volume momentum, then writes a
          short case for each name near the top. Every run is kept, so you can see what
          the agent thought last week and whether it was right.
        </EmptyState>
      </Section>
    </div>
  );
}
