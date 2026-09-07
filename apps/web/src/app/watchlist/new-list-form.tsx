"use client";

import { useTransition, useState } from "react";
import { ActionStyle } from "@/components/ui/primitives";
import { createList } from "@/lib/watchlist/actions";
import { BasketFields, type BasketDraft } from "./basket-fields";

export function NewListForm({ onCancel }: { onCancel?: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<BasketDraft>({
    name: "",
    description: "",
    isPublic: false,
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = draft.name.trim();
    if (!trimmed) {
      setError("Give the basket a name.");
      return;
    }
    startTransition(async () => {
      // createList redirects on success; Next's client runtime intercepts
      // that internally, so nothing here needs to await a return value.
      await createList({
        name: trimmed,
        description: draft.description.trim() || undefined,
        visibility: draft.isPublic ? "public" : "private",
      });
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5 px-6 py-5">
      <BasketFields idPrefix="new-list" draft={draft} onChange={setDraft} />
      {error ? <p className="text-detail text-loss">{error}</p> : null}
      <div className="flex items-center gap-2 border-t border-line pt-4">
        <button type="submit" disabled={pending} className={ActionStyle()}>
          {pending ? "Creating…" : "Create basket"}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className={ActionStyle({ variant: "quiet" })}
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
