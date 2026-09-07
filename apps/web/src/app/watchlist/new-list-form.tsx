"use client";

import { useTransition, useState } from "react";
import { ActionStyle } from "@/components/ui/primitives";
import { createList } from "@/lib/watchlist/actions";

export function NewListForm({ onCancel }: { onCancel?: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give the basket a name.");
      return;
    }
    startTransition(async () => {
      // createList redirects on success; Next's client runtime intercepts
      // that internally, so nothing here needs to await a return value.
      await createList({
        name: trimmed,
        description: description.trim() || undefined,
        visibility: isPublic ? "public" : "private",
      });
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 px-6 py-5">
      <div>
        <label className="text-detail text-ink-muted" htmlFor="list-name">
          Name
        </label>
        <input
          id="list-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          placeholder="Momentum picks — September"
          autoFocus
          className="mt-1 w-full rounded-md border border-line-strong bg-canvas px-3 py-2 text-body text-ink outline-none focus:border-accent"
        />
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <label className="text-detail text-ink-muted" htmlFor="list-description">
            Description
          </label>
          <span className="text-meta text-ink-subtle">{description.length}/200</span>
        </div>
        <input
          id="list-description"
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 200))}
          maxLength={200}
          placeholder="Optional"
          className="mt-1 w-full rounded-md border border-line-strong bg-canvas px-3 py-2 text-body text-ink outline-none focus:border-accent"
        />
      </div>
      <label className="flex items-start gap-2 text-body text-ink">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
          className="mt-1"
        />
        <span>
          Make this list public
          <span className="mt-0.5 block text-detail text-ink-muted">
            Private lists are visible only to you; public lists can be opened by anyone
            signed in.
          </span>
        </span>
      </label>
      {error ? <p className="text-detail text-loss">{error}</p> : null}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={ActionStyle()}>
          {pending ? "Creating…" : "Create basket"}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className={ActionStyle({ variant: "ghost" })}
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
