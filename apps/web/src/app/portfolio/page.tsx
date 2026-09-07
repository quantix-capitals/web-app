import { PageHeader } from "@/components/shell/page-header";
import { IconPortfolio } from "@/components/shell/nav-icons";
import {
  ActionStyle,
  EmptyState,
  Section,
  Stat,
  StatBand,
} from "@/components/ui/primitives";

export const metadata = { title: "Portfolio — Stealth Mode" };

/**
 * The book. Holdings and trades come from `holdings` / `trades` in Supabase; the
 * table below renders once `lib/supabase/server.ts` is wired.
 */
export default function PortfolioPage() {
  return (
    <div className="console-ground">
      <PageHeader
        title="Portfolio"
        subtitle="Every position you hold, what it cost, and what it is worth now."
        actions={
          <button type="button" className={ActionStyle()}>
            Add a holding
          </button>
        }
      />

      <Section>
        <StatBand>
          <Stat label="Market value" value="—" />
          <Stat label="Invested" value="—" hint="Cost basis across open positions" />
          <Stat label="Unrealised P&L" value="—" hint="Mark to last close" />
          <Stat label="Realised P&L" value="—" hint="Booked, this financial year" />
        </StatBand>
      </Section>

      <Section flush>
        <EmptyState
          icon={<IconPortfolio className="size-5" />}
          title="No holdings yet"
          action={
            <button type="button" className={ActionStyle()}>
              Add your first holding
            </button>
          }
        >
          Add what you already own — symbol, quantity, average cost — and the desk starts
          tracking it. You can also import a broker statement once that&apos;s wired up.
        </EmptyState>
      </Section>
    </div>
  );
}
