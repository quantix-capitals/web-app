/* eslint-disable react-refresh/only-export-components */

/**
 * Who is signed in, for the whole app.
 *
 * Sign-in is a magic link and nothing else — there is no password to store, and
 * `detectSessionInUrl` on the client means the link's `?code=` is exchanged
 * without a callback route of our own. `onAuthStateChange` then covers the rest:
 * a token refresh, a sign-out in another tab, a link opened in this one.
 *
 * `loading` starts true and matters: the first paint happens before Supabase has
 * read localStorage, and rendering the signed-out state in that gap is the flash
 * where a signed-in user sees "Sign in" on their own dashboard.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/services/supabase";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** Sends the magic link. Resolves once it's away, not once it's clicked. */
  sendMagicLink: (email: string, next?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Without a project there is nothing to wait for; every page renders its
    // signed-out state rather than hanging on a client that can't answer.
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const sendMagicLink = useCallback(async (email: string, next = "/watchlist") => {
    const address = email.trim();
    if (!address) throw new Error("Enter an email address.");

    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: {
        // Back to this origin, wherever it is deployed. The `next` is read by
        // the callback page once the client has exchanged the code.
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) throw new Error(error.message);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      sendMagicLink,
      signOut,
    }),
    [session, loading, sendMagicLink, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside an AuthProvider.");
  return ctx;
}
