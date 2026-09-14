/**
 * Editing a brief.
 *
 * The form holds text, not the brief itself: a target typed as "2" on the way
 * to "25", or a list of pluses mid-line, is not yet a number or a list, and
 * converting on every keystroke fights the typing. It converts once, on save.
 *
 * Every symbol the basket holds gets a row, in the basket's order, whether or
 * not the brief mentions it — a holding with no thesis is the gap the form is
 * there to close. Symbols the brief describes but the basket no longer holds are
 * kept, marked, and removable.
 *
 * Authorship follows the words: a draft from the analyst opens as written by the
 * agent, and becomes the person's the moment they change it.
 */

import { useState, type ReactNode } from "react";
import { ActionStyle, Field, FieldStyle } from "@/components/ui/primitives";
import { cn } from "@/lib/format";
import {
  authorLabel,
  emptyHolding,
  normalizeBrief,
  type Brief,
  type BriefAuthor,
} from "@/lib/watchlist/brief";

export interface HeldSymbol {
  symbol: string;
  name: string | null;
}

interface HoldingForm {
  symbol: string;
  name: string | null;
  held: boolean;
  role: string;
  thesis: string;
  pluses: string;
  minuses: string;
  /** Percent, as typed: "25" is +25%. */
  target: string;
  /** Percent, as typed, positive: "12" is −12%. */
  stop: string;
}

interface Form {
  motive: string;
  method: string;
  horizonMonths: string;
  reviewBy: string;
  success: string;
  invalidation: string;
  sectors: string;
  notes: string;
  holdings: HoldingForm[];
}

function percentText(fraction: number | null): string {
  return fraction === null ? "" : String(Math.round(Math.abs(fraction) * 1000) / 10);
}

function toForm(brief: Brief, held: HeldSymbol[]): Form {
  const bySymbol = new Map(brief.holdings.map((h) => [h.symbol.toUpperCase(), h]));
  const heldSet = new Set(held.map((h) => h.symbol));

  const row = (symbol: string, name: string | null, isHeld: boolean): HoldingForm => {
    const h = bySymbol.get(symbol) ?? emptyHolding(symbol);
    return {
      symbol,
      name,
      held: isHeld,
      role: h.role,
      thesis: h.thesis,
      pluses: h.pluses.join("\n"),
      minuses: h.minuses.join("\n"),
      target: percentText(h.target),
      stop: percentText(h.stop),
    };
  };

  return {
    motive: brief.motive,
    method: brief.method,
    horizonMonths: brief.horizonMonths === null ? "" : String(brief.horizonMonths),
    reviewBy: brief.reviewBy ?? "",
    success: brief.success,
    invalidation: brief.invalidation,
    sectors: brief.sectors.join(", "),
    notes: brief.notes,
    holdings: [
      ...held.map((h) => row(h.symbol, h.name, true)),
      ...brief.holdings
        .filter((h) => !heldSet.has(h.symbol.toUpperCase()))
        .map((h) => row(h.symbol.toUpperCase(), null, false)),
    ],
  };
}

function fromForm(form: Form): Brief {
  const pct = (text: string) => {
    const n = Number.parseFloat(text.trim());
    return text.trim() === "" || !Number.isFinite(n) ? null : n / 100;
  };
  const lines = (text: string) =>
    text
      .split("\n")
      .map((l) => l.replace(/^\s*[-*+•]\s*/, "").trim())
      .filter(Boolean);
  const months = Number.parseInt(form.horizonMonths, 10);

  return normalizeBrief({
    motive: form.motive.trim(),
    method: form.method.trim(),
    horizonMonths: Number.isFinite(months) && months > 0 ? months : null,
    reviewBy: form.reviewBy || null,
    success: form.success.trim(),
    invalidation: form.invalidation.trim(),
    sectors: form.sectors
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    notes: form.notes.trim(),
    holdings: form.holdings.map((h) => ({
      symbol: h.symbol,
      role: h.role.trim(),
      thesis: h.thesis.trim(),
      pluses: lines(h.pluses),
      minuses: lines(h.minuses),
      target: pct(h.target),
      stop: pct(h.stop),
    })),
  });
}

export function BriefEditor({
  initial,
  author,
  held,
  saving,
  error,
  onSave,
  onCancel,
}: {
  initial: Brief;
  author: BriefAuthor;
  held: HeldSymbol[];
  saving: boolean;
  error: string | null;
  onSave: (brief: Brief, author: BriefAuthor) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(() => toForm(initial, held));
  const [who, setWho] = useState<BriefAuthor>(author);

  const update = (patch: Partial<Form>) => {
    setForm((f) => ({ ...f, ...patch }));
    setWho("user");
  };
  const updateHolding = (symbol: string, patch: Partial<HoldingForm>) => {
    setForm((f) => ({
      ...f,
      holdings: f.holdings.map((h) => (h.symbol === symbol ? { ...h, ...patch } : h)),
    }));
    setWho("user");
  };
  const removeHolding = (symbol: string) => {
    setForm((f) => ({ ...f, holdings: f.holdings.filter((h) => h.symbol !== symbol) }));
    setWho("user");
  };

  const area = (value: string, onChange: (v: string) => void, id: string, placeholder: string, rows = 3) => (
    <textarea
      id={id}
      value={value}
      rows={rows}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(FieldStyle(), "resize-y")}
    />
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(fromForm(form), who);
      }}
      className="max-w-4xl"
    >
      <Group title="The basket" reading="What the analyst judges every call against.">
        <Field label="Why this basket exists" htmlFor="brief-motive">
          {area(form.motive, (motive) => update({ motive }), "brief-motive", "The question this basket answers, or the bet it makes.", 4)}
        </Field>
        <Field label="How it was built" htmlFor="brief-method">
          {area(form.method, (method) => update({ method }), "brief-method", "The screen, the source of the names, the reasoning.")}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Horizon, in months" htmlFor="brief-horizon">
            <input
              id="brief-horizon"
              type="number"
              min={1}
              max={120}
              inputMode="numeric"
              value={form.horizonMonths}
              onChange={(e) => update({ horizonMonths: e.target.value })}
              placeholder="e.g. 12"
              className={FieldStyle()}
            />
          </Field>
          <Field label="Judge it by (optional date)" htmlFor="brief-review-by">
            <input
              id="brief-review-by"
              type="date"
              value={form.reviewBy}
              onChange={(e) => update({ reviewBy: e.target.value })}
              className={FieldStyle()}
            />
          </Field>
        </div>
        <Field label="What working looks like" htmlFor="brief-success">
          {area(form.success, (success) => update({ success }), "brief-success", "e.g. Beats NIFTY 50 by 5 points over the horizon.")}
        </Field>
        <Field label="What would prove it wrong" htmlFor="brief-invalidation">
          {area(form.invalidation, (invalidation) => update({ invalidation }), "brief-invalidation", "e.g. Order inflows fall two quarters running.")}
        </Field>
        <Field label="Where ideas should come from" htmlFor="brief-sectors">
          <input
            id="brief-sectors"
            value={form.sectors}
            onChange={(e) => update({ sectors: e.target.value })}
            placeholder="Sectors, comma-separated. Leave empty for anywhere."
            className={FieldStyle()}
          />
        </Field>
      </Group>

      <Group
        title="Holdings"
        reading="Per holding: its role, the case, and one plus or minus per line. Target and stop are percentages from entry."
      >
        {form.holdings.length === 0 ? (
          <p className="text-detail text-ink-muted">This basket holds nothing yet.</p>
        ) : null}
        {form.holdings.map((h) => (
          <fieldset key={h.symbol} className="space-y-3 border-t border-line pt-4 first:border-t-0 first:pt-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <legend className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-body font-medium text-ink">{h.symbol}</span>
                {h.name ? <span className="text-meta text-ink-subtle">{h.name}</span> : null}
                {h.held ? null : <span className="text-meta text-warn">no longer held</span>}
              </legend>
              {h.held ? null : (
                <button
                  type="button"
                  onClick={() => removeHolding(h.symbol)}
                  className="text-meta font-medium text-ink-subtle underline underline-offset-2 hover:text-loss"
                >
                  Remove from brief
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_8rem_8rem]">
              <Field label="Role" htmlFor={`brief-${h.symbol}-role`}>
                <input
                  id={`brief-${h.symbol}-role`}
                  value={h.role}
                  onChange={(e) => updateHolding(h.symbol, { role: e.target.value })}
                  placeholder="e.g. core compounder"
                  className={FieldStyle()}
                />
              </Field>
              <Field label="Target +%" htmlFor={`brief-${h.symbol}-target`}>
                <input
                  id={`brief-${h.symbol}-target`}
                  type="number"
                  step="any"
                  min={0}
                  value={h.target}
                  onChange={(e) => updateHolding(h.symbol, { target: e.target.value })}
                  placeholder="25"
                  className={FieldStyle()}
                />
              </Field>
              <Field label="Stop −%" htmlFor={`brief-${h.symbol}-stop`}>
                <input
                  id={`brief-${h.symbol}-stop`}
                  type="number"
                  step="any"
                  min={0}
                  value={h.stop}
                  onChange={(e) => updateHolding(h.symbol, { stop: e.target.value })}
                  placeholder="12"
                  className={FieldStyle()}
                />
              </Field>
            </div>
            <Field label="Thesis" htmlFor={`brief-${h.symbol}-thesis`}>
              {area(h.thesis, (thesis) => updateHolding(h.symbol, { thesis }), `brief-${h.symbol}-thesis`, "Why it is in this basket.", 2)}
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Pluses — one per line" htmlFor={`brief-${h.symbol}-pluses`}>
                {area(h.pluses, (pluses) => updateHolding(h.symbol, { pluses }), `brief-${h.symbol}-pluses`, "Order book at record high", 3)}
              </Field>
              <Field label="Minuses — one per line" htmlFor={`brief-${h.symbol}-minuses`}>
                {area(h.minuses, (minuses) => updateHolding(h.symbol, { minuses }), `brief-${h.symbol}-minuses`, "Working capital stretched", 3)}
              </Field>
            </div>
          </fieldset>
        ))}
      </Group>

      <Group title="Notes">
        <Field label="Anything else" htmlFor="brief-notes">
          {area(form.notes, (notes) => update({ notes }), "brief-notes", "Free text. Markdown bullets and bold are fine.", 4)}
        </Field>
      </Group>

      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-line bg-canvas px-6 py-4">
        <button type="submit" disabled={saving} className={ActionStyle()}>
          {saving ? "Saving…" : "Save brief"}
        </button>
        <button type="button" onClick={onCancel} disabled={saving} className={ActionStyle({ variant: "quiet" })}>
          Cancel
        </button>
        <span className="text-meta text-ink-subtle">Saved as written by {authorLabel(who)}.</span>
        {error ? <span className="text-detail text-loss">{error}</span> : null}
      </div>
    </form>
  );
}

function Group({ title, reading, children }: { title: string; reading?: string; children: ReactNode }) {
  return (
    <section className="space-y-4 border-b border-line px-6 py-5">
      <div>
        <h3 className="text-body font-semibold tracking-tight text-ink">{title}</h3>
        {reading ? <p className="mt-0.5 text-detail text-ink-muted">{reading}</p> : null}
      </div>
      {children}
    </section>
  );
}
