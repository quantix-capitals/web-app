import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppShell } from "@/components/shell/app-shell";
import { AuthProvider } from "@/context/auth-context";
import { PageSkeleton } from "@/components/ui/skeleton";

/**
 * Routes are lazy so the first load ships the shell and nothing else. The heavy
 * ones are the point: the overview pulls in three.js for its canvas, and the
 * basket pages pull in the quote store and P&L maths — none of which a signed-out
 * visitor landing on /profile should pay for.
 *
 * Every page here is a named export, remapped to `default` for `React.lazy`.
 */
const Home = lazy(() => import("./pages/home").then((m) => ({ default: m.Home })));
const Watchlist = lazy(() =>
  import("./pages/watchlist/watchlist").then((m) => ({ default: m.Watchlist })),
);
const Basket = lazy(() =>
  import("./pages/watchlist/basket").then((m) => ({ default: m.Basket })),
);
const Portfolio = lazy(() =>
  import("./pages/portfolio").then((m) => ({ default: m.Portfolio })),
);
const Momentum = lazy(() => import("./pages/momentum").then((m) => ({ default: m.Momentum })));
const Profile = lazy(() => import("./pages/profile").then((m) => ({ default: m.Profile })));
const AuthCallback = lazy(() =>
  import("./pages/auth-callback").then((m) => ({ default: m.AuthCallback })),
);
const ZerodhaCallback = lazy(() =>
  import("./pages/zerodha-callback").then((m) => ({ default: m.ZerodhaCallback })),
);
const NotFound = lazy(() => import("./pages/not-found").then((m) => ({ default: m.NotFound })));

/**
 * Prices are polled by the quote store on their own schedule, so nothing here
 * needs a window-focus refetch — the rows that go stale are the basket contents,
 * and those change only when this tab changes them.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, staleTime: 60_000, retry: 1 },
  },
});

export function App() {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppShell>
            <Suspense fallback={<PageSkeleton />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/watchlist" element={<Watchlist />} />
                <Route path="/watchlist/:id" element={<Basket />} />
                <Route path="/portfolio" element={<Portfolio />} />
                <Route path="/momentum" element={<Momentum />} />
                <Route path="/profile" element={<Profile />} />

                {/* Where a magic link lands. The Supabase client exchanges the
                    `?code=` on its own; this page only waits and forwards. */}
                <Route path="/auth/callback" element={<AuthCallback />} />

                {/* Kite's registered redirect. `useKiteCallback` also runs on
                    /portfolio, because which of the two Zerodha uses is a
                    console setting we cannot read from here. */}
                <Route path="/zerodha/callback" element={<ZerodhaCallback />} />

                {/* The old server route; nothing serves it now. */}
                <Route path="/auth/sign-out" element={<Navigate to="/profile" replace />} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AppShell>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}
