import { Link } from "react-router-dom";
import { ActionStyle, EmptyState } from "@/components/ui/primitives";

export function NotFound() {
  return (
    <div className="bg-canvas">
      <EmptyState
        title="No such page"
        action={
          <Link to="/" className={ActionStyle({ variant: "ghost" })}>
            Back to the desk
          </Link>
        }
      >
        The link is stale, or the route hasn&apos;t been built yet.
      </EmptyState>
    </div>
  );
}
