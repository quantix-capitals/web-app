import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ActionStyle } from "@/components/ui/primitives";
import { createBasket } from "@/services/watchlist-service";
import { basketsKey } from "./keys";
import { BasketFields, type BasketDraft } from "./basket-fields";

export function NewListForm({ onCancel }: { onCancel?: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<BasketDraft>({
    name: "",
    description: "",
    isPublic: false,
  });

  const create = useMutation({
    mutationFn: (name: string) =>
      createBasket({
        name,
        description: draft.description.trim() || undefined,
        visibility: draft.isPublic ? "public" : "private",
      }),
    // Straight into the basket that was just made — creating one is only ever
    // the first half of "add some symbols".
    onSuccess: (id) => {
      void queryClient.invalidateQueries({ queryKey: basketsKey() });
      navigate(`/watchlist/${id}`);
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : "Could not create the basket."),
  });
  const pending = create.isPending;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = draft.name.trim();
    if (!trimmed) {
      setError("Give the basket a name.");
      return;
    }
    create.mutate(trimmed);
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
