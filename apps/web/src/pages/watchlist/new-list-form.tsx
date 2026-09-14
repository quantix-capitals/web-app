import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ActionStyle, Field, FieldStyle } from "@/components/ui/primitives";
import { cn } from "@/lib/format";
import { emptyBrief } from "@/lib/watchlist/brief";
import { createBasket } from "@/services/watchlist-service";
import { basketsKey } from "./keys";
import { BasketFields, type BasketDraft } from "./basket-fields";

const HORIZONS = [1, 3, 6, 12, 24, 36, 60];

export function NewListForm({ onCancel }: { onCancel?: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<BasketDraft>({
    name: "",
    description: "",
    isPublic: false,
  });
  // The start of the brief. Asked for here because the reason a basket was
  // struck is clearest at the moment it is struck; the rest of the brief —
  // per-holding pluses, minuses, targets — waits until there are holdings.
  const [motive, setMotive] = useState("");
  const [horizon, setHorizon] = useState("");

  const create = useMutation({
    mutationFn: (name: string) =>
      createBasket({
        name,
        description: draft.description.trim() || undefined,
        visibility: draft.isPublic ? "public" : "private",
        brief:
          motive.trim() || horizon
            ? {
                ...emptyBrief(),
                motive: motive.trim(),
                horizonMonths: horizon ? Number(horizon) : null,
              }
            : undefined,
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

      <Field label="Why this basket?" htmlFor="new-list-motive">
        <textarea
          id="new-list-motive"
          value={motive}
          onChange={(e) => setMotive(e.target.value)}
          rows={3}
          placeholder="Optional. The bet this basket makes — the analyst judges every call against it."
          className={cn(FieldStyle(), "resize-y")}
        />
      </Field>

      <Field label="Horizon" htmlFor="new-list-horizon">
        <select
          id="new-list-horizon"
          value={horizon}
          onChange={(e) => setHorizon(e.target.value)}
          className={FieldStyle()}
        >
          <option value="">Not set</option>
          {HORIZONS.map((m) => (
            <option key={m} value={m}>
              {m < 12 ? `${m} ${m === 1 ? "month" : "months"}` : `${m / 12} ${m === 12 ? "year" : "years"}`}
            </option>
          ))}
        </select>
      </Field>

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
