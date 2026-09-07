import { Link } from "react-router-dom";
import { ActionStyle, EmptyState, Section } from "@/components/ui/primitives";
import { useKiteCallback } from "@/lib/zerodha/use-callback";

/**
 * The canonical place to register as the Kite app's redirect URL. It exchanges
 * the request token, writes the session to localStorage, and moves on to the
 * portfolio. Nothing to click.
 *
 * The portfolio page runs the same hook, so a Kite app pointed at `/portfolio`
 * instead of here still completes the login. This route exists so the redirect
 * has an obvious, dedicated home — not because the handshake needs it.
 */
export function ZerodhaCallback() {
  const { status, error } = useKiteCallback();

  if (status === "error") {
    return (
      <div className="bg-canvas">
        <Section flush>
          <EmptyState
            title="Zerodha connection failed"
            action={
              <Link to="/portfolio" className={ActionStyle()}>
                Back to portfolio
              </Link>
            }
          >
            {error}
          </EmptyState>
        </Section>
      </div>
    );
  }

  return <Working />;
}

function Working() {
  return (
    <div className="bg-canvas">
      <Section flush>
        <EmptyState title="Connecting to Zerodha">
          Finishing the handshake and reading your holdings. This takes a second.
        </EmptyState>
      </Section>
    </div>
  );
}
