import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { EmptyState, Section } from "@/components/ui/primitives";
import { useAuth } from "@/context/auth-context";

/**
 * Where a magic link lands.
 *
 * There is nothing to exchange here by hand: `detectSessionInUrl` on the
 * Supabase client consumes the `?code=` as it starts up, and `onAuthStateChange`
 * tells the auth context about it. This page only waits for that to land and
 * then forwards — which is why it watches `user` rather than doing any work.
 *
 * Supabase reports a rejected link in the query string rather than by failing,
 * so `error_description` is surfaced on the profile page, where the sign-in form
 * the user needs to try again already lives.
 */
export function AuthCallback() {
  const [params] = useSearchParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const next = params.get("next") ?? "/watchlist";
  const authError = params.get("error_description");

  useEffect(() => {
    if (authError) {
      navigate(`/profile?auth_error=${encodeURIComponent(authError)}`, { replace: true });
      return;
    }
    if (loading) return;
    navigate(user ? next : "/profile?auth_error=That+sign-in+link+has+expired.", {
      replace: true,
    });
  }, [authError, loading, user, next, navigate]);

  return (
    <div className="bg-canvas">
      <Section flush>
        <EmptyState title="Signing you in">One moment.</EmptyState>
      </Section>
    </div>
  );
}
