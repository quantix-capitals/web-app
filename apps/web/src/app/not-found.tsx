import Link from "next/link";
import { ActionStyle, EmptyState } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <div className="bg-canvas">
      <EmptyState
        title="No such page"
        action={
          <Link href="/" className={ActionStyle({ variant: "ghost" })}>
            Back to the desk
          </Link>
        }
      >
        The link is stale, or the route hasn&apos;t been built yet.
      </EmptyState>
    </div>
  );
}
