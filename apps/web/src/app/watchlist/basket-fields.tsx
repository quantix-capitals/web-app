"use client";

import { CheckField, Field, FieldStyle } from "@/components/ui/primitives";

export interface BasketDraft {
  name: string;
  description: string;
  isPublic: boolean;
}

/**
 * Creating a basket and editing one ask for exactly the same three things, so
 * they ask in exactly the same shape — the two forms had drifted apart on
 * label size, placeholder and field background before this.
 */
export function BasketFields({
  idPrefix,
  draft,
  onChange,
}: {
  idPrefix: string;
  draft: BasketDraft;
  onChange: (next: BasketDraft) => void;
}) {
  return (
    <>
      <Field label="Name" htmlFor={`${idPrefix}-name`}>
        <input
          id={`${idPrefix}-name`}
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
          maxLength={80}
          placeholder="Momentum picks — September"
          autoFocus
          className={FieldStyle()}
        />
      </Field>

      <Field
        label="Description"
        htmlFor={`${idPrefix}-description`}
        count={`${draft.description.length}/200`}
      >
        <input
          id={`${idPrefix}-description`}
          value={draft.description}
          onChange={(e) => onChange({ ...draft, description: e.target.value.slice(0, 200) })}
          maxLength={200}
          placeholder="Optional"
          className={FieldStyle()}
        />
      </Field>

      <CheckField
        checked={draft.isPublic}
        onChange={(isPublic) => onChange({ ...draft, isPublic })}
        label="Make this basket public"
      >
        Private baskets are visible only to you; public ones can be opened by anyone signed in.
      </CheckField>
    </>
  );
}
