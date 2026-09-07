"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ActionStyle } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/format";
import { deleteList, updateList } from "@/lib/watchlist/actions";
import type { WatchlistSummary } from "@/lib/watchlist/types";
import { BasketFields, type BasketDraft } from "../basket-fields";

/**
 * A modal, not an inline panel — editing a basket shares its field set with
 * creating one, and a panel here would reflow the holdings table the owner
 * was just reading.
 */
export function ListSettings({ list }: { list: WatchlistSummary }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        className={ActionStyle({ variant: "ghost" })}
      >
        Settings
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Basket settings">
        <SettingsForm list={list} onClose={() => setOpen(false)} />
      </Modal>
    </>
  );
}

function SettingsForm({ list, onClose }: { list: WatchlistSummary; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<BasketDraft>({
    name: list.name,
    description: list.description ?? "",
    isPublic: list.visibility === "public",
  });
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateList(list.id, {
        name: draft.name,
        description: draft.description,
        visibility: draft.isPublic ? "public" : "private",
      });
      if (result.status === "error") setError(result.error);
      else {
        router.refresh();
        onClose();
      }
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
    <form onSubmit={onSave} className="flex flex-col gap-5 px-6 py-5">
      <BasketFields idPrefix="settings" draft={draft} onChange={setDraft} />
      {error ? <p className="text-detail text-loss">{error}</p> : null}
      {/* Save sits with Cancel; deleting the basket is held apart from both,
          on the far side of the row, so it is never the button you reach for
          by muscle memory. */}
      <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
        <div className="flex items-center gap-2">
          <button type="submit" disabled={pending} className={ActionStyle()}>
            {pending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className={ActionStyle({ variant: "quiet" })}
          >
            Cancel
          </button>
        </div>
        <button
          type="button"
          onClick={onDelete}
          onBlur={() => setConfirmDelete(false)}
          disabled={pending}
          className={cn(
            "rounded-md px-3 py-2 text-body font-medium transition",
            confirmDelete
              ? "bg-loss-soft text-loss"
              : "text-ink-subtle hover:bg-loss-soft hover:text-loss",
          )}
        >
          {confirmDelete ? "Really delete?" : "Delete basket"}
        </button>
      </div>
    </form>
  );
}
