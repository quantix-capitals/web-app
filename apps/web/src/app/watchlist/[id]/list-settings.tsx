"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ActionStyle, Section, SectionHeader } from "@/components/ui/primitives";
import { deleteList, updateList } from "@/lib/watchlist/actions";
import type { WatchlistSummary } from "@/lib/watchlist/types";

export function ListSettings({ list }: { list: WatchlistSummary }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(list.name);
  const [description, setDescription] = useState(list.description ?? "");
  const [isPublic, setIsPublic] = useState(list.visibility === "public");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateList(list.id, {
        name,
        description,
        visibility: isPublic ? "public" : "private",
      });
      if (result.status === "error") setError(result.error);
      else router.refresh();
    });
  }

  function onDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    startTransition(async () => {
      await deleteList(list.id);
    });
  }

  return (
    <Section flush>
      <SectionHeader title="Settings" />
      <form onSubmit={onSave} className="flex flex-col gap-4 px-6 py-5">
        <div>
          <label className="text-detail text-ink-muted" htmlFor="settings-name">
            Name
          </label>
          <input
            id="settings-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            className="mt-1 w-full max-w-md rounded-md border border-line-strong bg-canvas px-3 py-2 text-body text-ink outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="text-detail text-ink-muted" htmlFor="settings-description">
            Description
          </label>
          <input
            id="settings-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full max-w-md rounded-md border border-line-strong bg-canvas px-3 py-2 text-body text-ink outline-none focus:border-accent"
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
            Save
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className={ActionStyle({ variant: "ghost" })}
          >
            {confirmDelete ? "Really delete?" : "Delete basket"}
          </button>
        </div>
      </form>
    </Section>
  );
}
