import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/shell/page-header";
import {
  ActionStyle,
  Badge,
  Empty,
  Section,
  SectionHeader,
} from "@/components/ui/primitives";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/context/auth-context";
import { isSupabaseConfigured, supabase } from "@/services/supabase";
import { SignInForm } from "./sign-in-form";

interface ProfileRow {
  display_name: string | null;
  base_currency: string;
  created_at: string;
}

/**
 * Account and preferences. Backed by the `profiles` row Supabase auth creates
 * on sign-up.
 */
export function Profile() {
  const [params] = useSearchParams();
  const { user, signOut } = useAuth();
  const authError = params.get("auth_error");

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: Boolean(user) && isSupabaseConfigured(),
    queryFn: async (): Promise<ProfileRow | null> => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, base_currency, created_at")
        .eq("id", user!.id)
        .single();
      return data;
    },
  });

  return (
    <div className="bg-canvas">
      <PageHeader
        title="Profile"
        subtitle="Your account, your base currency, and how the agent is allowed to work."
      />

      {authError ? (
        <Section>
          <div className="px-6 py-3 text-detail text-loss">{authError}</div>
        </Section>
      ) : null}

      <Section>
        <SectionHeader
          title="Account"
          subtitle={user ? "Signed in via Supabase auth." : "Sign in below with a magic link."}
          right={
            user ? <Badge tone="gain">Signed in</Badge> : <Badge tone="warn">Not signed in</Badge>
          }
        />
        <dl className="divide-y divide-line">
          <Field label="Name" value={profile?.display_name ?? undefined} />
          <Field label="Email" value={user?.email ?? undefined} />
          <Field label="Base currency" value={profile?.base_currency} />
          <Field
            label="Member since"
            value={profile?.created_at ? formatDate(profile.created_at) : undefined}
          />
        </dl>
      </Section>

      <Section flush>
        <SectionHeader
          title="Appearance"
          subtitle="Light, dark, or whatever this device is set to. Stored on this device only."
        />
        <div className="px-6 py-5">
          <ThemeToggle />
        </div>
      </Section>

      <Section>
        <SectionHeader
          title="Agent"
          subtitle="What the agent may do on its own, and what it must ask about first."
        />
        <Empty inline>Nothing to configure until the agent service is connected.</Empty>
      </Section>

      <Section flush>
        <SectionHeader title="Session" />
        <div className="px-6 py-5">
          {user ? (
            <button
              type="button"
              onClick={() => void signOut()}
              className={ActionStyle({ variant: "ghost" })}
            >
              Sign out
            </button>
          ) : (
            <SignInForm />
          )}
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
