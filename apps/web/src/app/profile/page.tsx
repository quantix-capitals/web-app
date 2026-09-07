import { PageHeader } from "@/components/shell/page-header";
import {
  ActionStyle,
  Badge,
  Empty,
  Section,
  SectionHeader,
} from "@/components/ui/primitives";

export const metadata = { title: "Profile — Stealth Mode" };

/**
 * Account and preferences. Backed by the `profiles` row Supabase auth creates on
 * sign-up; every field here is read-only until the client is wired.
 */
export default function ProfilePage() {
  return (
    <div className="bg-canvas">
      <PageHeader
        title="Profile"
        subtitle="Your account, your base currency, and how the agent is allowed to work."
      />

      <Section>
        <SectionHeader
          title="Account"
          subtitle="Comes from Supabase auth once sign-in is wired."
          right={<Badge tone="warn">Not signed in</Badge>}
        />
        <dl className="divide-y divide-line">
          <Field label="Name" />
          <Field label="Email" />
          <Field label="Base currency" />
          <Field label="Member since" />
        </dl>
      </Section>

      <Section>
        <SectionHeader
          title="Agent"
          subtitle="What the agent may do on its own, and what it must ask about first."
        />
        <Empty inline>
          Nothing to configure until the agent service is connected.
        </Empty>
      </Section>

      <Section flush>
        <SectionHeader title="Session" />
        <div className="px-6 py-5">
          <button type="button" className={ActionStyle({ variant: "ghost" })}>
            Sign in
          </button>
        </div>
      </Section>
    </div>
  );
}

/** A label/value pair on the same gutter as every other row on the page. */
function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-baseline gap-4 px-6 py-3.5">
      <dt className="w-40 shrink-0 text-detail text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-body text-ink">
        {value ?? <span className="text-ink-subtle">—</span>}
      </dd>
    </div>
  );
}
