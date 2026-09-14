/**
 * The Brief tab: why this basket exists, how long it is meant to run, and the
 * case for and against each holding.
 *
 * Whoever struck the basket owns the brief — a person writes it here, the agent
 * can draft it, and code can supply it at creation. Every analyst run is handed
 * it by default, so this page is also where to look to understand *why* the
 * analyst called something the way it did.
 *
 * The owner can edit it or have the analyst draft or refine it; everyone else
 * who can see the basket can read it. A draft is never saved on its own — it
 * opens in the editor, and saving it is the owner's decision.
 */

import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ActionStyle, Badge, Field, FieldStyle, Meter } from "@/components/ui/primitives";
import { HeadRow, Table, Td, Th, Tr } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDate, formatPercent, formatRelative } from "@/lib/format";
import { isConfigured, KEY_SETUP } from "@/lib/analyst/client";
import { briefKey } from "@/lib/analyst/keys";
import { loadAgent } from "@/lib/analyst/load";
import { briefFilename, downloadMarkdown } from "@/lib/analyst/report";
import { describeFailure } from "@/lib/analyst/use-analyst";
import {
  authorLabel,
  emptyBrief,
  horizonEnd,
  horizonProgress,
  type Brief,
  type BriefAuthor,
  type StoredBrief,
} from "@/lib/watchlist/brief";
import type { WatchlistSummary } from "@/lib/watchlist/types";
import { bookRef } from "@/lib/watchlist/book";
import { getBrief, saveBrief } from "@/services/brief-service";
import { Prose } from "../analyst/prose";
import { BriefEditor, type HeldSymbol } from "./brief-editor";

type Mode = "read" | "edit" | "draft";

export function BriefView({ list }: { list: WatchlistSummary }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: briefKey(bookRef(list)),
    queryFn: () => getBrief(bookRef(list)),
    enabled: Boolean(list.id),
  });
  const [mode, setMode] = useState<Mode>("read");
  const [editing, setEditing] = useState<{ brief: Brief; author: BriefAuthor } | null>(null);

  const held = useMemo<HeldSymbol[]>(() => {
    const seen = new Map<string, HeldSymbol>();
    for (const item of list.items) {
      const symbol = item.symbol.toUpperCase();
      if (symbol && !seen.has(symbol)) seen.set(symbol, { symbol, name: item.name });
    }
    return [...seen.values()];
  }, [list.items]);

  const save = useMutation({
    mutationFn: (input: { brief: Brief; author: BriefAuthor }) =>
      saveBrief(list, input.brief, input.author),
    onSuccess: (next) => {
      queryClient.setQueryData(briefKey(bookRef(list)), next);
      setMode("read");
      setEditing(null);
    },
  });

  const draft = useMutation({
    mutationFn: async (hint: string) => {
      const { draftBrief } = await loadAgent();
      return draftBrief({
        name: list.name,
        description: list.description,
        struck: list.createdAt,
        origin: list.createdBy,
        holdings: held,
        hint,
        existing: query.data?.markdown ?? null,
      });
    },
    onSuccess: (brief) => {
      setEditing({ brief, author: "agent" });
      setMode("edit");
    },
  });

  const stored = query.data ?? null;

  if (query.isPending) {
    return (
      <div className="space-y-3 px-6 py-6" role="status" aria-label="Loading brief">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-96 max-w-full" />
        <Skeleton className="h-3 w-80 max-w-full" />
      </div>
    );
  }

  if (query.isError) {
    return <p className="px-6 py-6 text-detail text-loss">{describeFailure(query.error)}</p>;
  }

  if (mode === "edit" && editing) {
    return (
      <BriefEditor
        key={`${editing.author}-${stored?.updatedAt ?? "new"}`}
        initial={editing.brief}
        author={editing.author}
        held={held}
        saving={save.isPending}
        error={save.isError ? describeFailure(save.error) : null}
        onSave={(brief, author) => save.mutate({ brief, author })}
        onCancel={() => {
          setMode("read");
          setEditing(null);
          save.reset();
        }}
      />
    );
  }

  if (mode === "draft") {
    return (
      <DraftPanel
        list={list}
        refining={Boolean(stored)}
        pending={draft.isPending}
        error={draft.isError ? describeFailure(draft.error) : null}
        onDraft={(hint) => draft.mutate(hint)}
        onCancel={() => {
          setMode("read");
          draft.reset();
        }}
      />
    );
  }

  const startEdit = () => {
    setEditing({
      brief: stored?.content ?? emptyBrief(),
      author: stored?.author ?? "user",
    });
    setMode("edit");
  };

  if (!stored) {
    return (
      <div className="max-w-3xl space-y-4 px-6 py-8">
        <h2 className="font-serif text-title tracking-tight text-ink">No brief yet</h2>
        <p className="text-detail leading-relaxed text-ink-muted">
          A brief records why this basket was struck, how long it is meant to run, what would count
          as it working or failing, and the case for and against each holding. The analyst is given
          it on every run, so its calls are made against what this basket is <em>for</em> — a
          three-month momentum basket and a ten-year compounding one deserve different advice.
        </p>
        {list.isOwner ? (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={startEdit} className={ActionStyle()}>
              Write the brief
            </button>
            <button type="button" onClick={() => setMode("draft")} className={ActionStyle({ variant: "ghost" })}>
              Draft it with the analyst
            </button>
          </div>
        ) : (
          <p className="text-meta text-ink-subtle">Only the basket&apos;s owner can write one.</p>
        )}
      </div>
    );
  }

  return (
    <BriefDocument
      list={list}
      stored={stored}
      held={held}
      onEdit={startEdit}
      onDraft={() => setMode("draft")}
    />
  );
}

// --- reading -----------------------------------------------------------------

function BriefDocument({
  list,
  stored,
  held,
  onEdit,
  onDraft,
}: {
  list: WatchlistSummary;
  stored: StoredBrief;
  held: HeldSymbol[];
  onEdit: () => void;
  onDraft: () => void;
}) {
  const [raw, setRaw] = useState(false);
  const b = stored.content;
  const described = new Set(b.holdings.map((h) => h.symbol.toUpperCase()));
  const heldSet = new Set(held.map((h) => h.symbol));
  const withoutThesis = held.filter((h) => !described.has(h.symbol));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
        <p className="text-meta text-ink-muted">
          Written by {authorLabel(stored.author)} · updated {formatRelative(stored.updatedAt)} · given
          to every analyst run unless unticked
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {list.isOwner ? (
            <>
              <button type="button" onClick={onEdit} className={ActionStyle({ variant: "ghost" })}>
                Edit
              </button>
              <button type="button" onClick={onDraft} className={ActionStyle({ variant: "ghost" })}>
                Refine with analyst
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => setRaw((v) => !v)}
            aria-pressed={raw}
            className={ActionStyle({ variant: "quiet" })}
          >
            {raw ? "Formatted" : "Markdown"}
          </button>
          <button
            type="button"
            onClick={() => downloadMarkdown(briefFilename(list.name), stored.markdown)}
            className={ActionStyle({ variant: "quiet" })}
          >
            Download .md
          </button>
        </div>
      </div>

      {raw ? (
        <pre className="overflow-x-auto whitespace-pre-wrap px-6 py-5 font-mono text-meta leading-relaxed text-ink">
          {stored.markdown}
        </pre>
      ) : (
        <div className="max-w-4xl">
          <Timeline brief={b} struck={list.createdAt} />
          <Part title="Why this basket exists" text={b.motive} />
          <Part title="How it was built" text={b.method} />
          <Part title="What working looks like" text={b.success} />
          <Part title="What would prove it wrong" text={b.invalidation} />
          {b.sectors.length ? (
            <Section title="Where ideas should come from">
              <div className="flex flex-wrap gap-1.5">
                {b.sectors.map((s) => (
                  <Badge key={s}>{s}</Badge>
                ))}
              </div>
            </Section>
          ) : null}

          {b.holdings.length ? (
            <section className="border-b border-line">
              <h3 className="px-6 pt-5 pb-2 text-body font-semibold tracking-tight text-ink">Holdings</h3>
              <Table minWidth="min-w-150">
                <HeadRow>
                  <Th align="left" first>
                    Symbol
                  </Th>
                  <Th align="left" grow>
                    Role
                  </Th>
                  <Th tight>Target</Th>
                  <Th tight>Stop</Th>
                  <Th tight>Pluses</Th>
                  <Th last tight>
                    Minuses
                  </Th>
                </HeadRow>
                <tbody>
                  {b.holdings.map((h) => (
                    <Tr key={h.symbol}>
                      <Td align="left" first>
                        <span className="font-mono font-medium text-ink">{h.symbol}</span>
                        {heldSet.has(h.symbol) ? null : (
                          <span className="ml-2 text-meta text-ink-subtle">no longer held</span>
                        )}
                      </Td>
                      <Td align="left" grow className="truncate text-ink-muted">
                        {h.role || "—"}
                      </Td>
                      <Td tight className="text-gain">
                        {h.target === null ? "—" : formatPercent(h.target, 0)}
                      </Td>
                      <Td tight className="text-loss">
                        {h.stop === null ? "—" : formatPercent(h.stop, 0)}
                      </Td>
                      <Td tight className="text-ink">{h.pluses.length}</Td>
                      <Td last tight className="text-ink">
                        {h.minuses.length}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>

              <div className="grid gap-px border-t border-line bg-line md:grid-cols-2">
                {b.holdings.map((h) => (
                  <div key={h.symbol} className="bg-canvas px-6 py-4">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-mono text-body font-medium text-ink">{h.symbol}</span>
                      {h.role ? <span className="text-meta text-ink-muted">{h.role}</span> : null}
                    </div>
                    {h.thesis ? (
                      <p className="mt-1.5 text-detail leading-relaxed text-ink-muted">{h.thesis}</p>
                    ) : null}
                    <PointList title="Pluses" sign="+" tone="text-gain" items={h.pluses} />
                    <PointList title="Minuses" sign="−" tone="text-loss" items={h.minuses} />
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {withoutThesis.length ? (
            <p className="border-b border-line px-6 py-3 text-meta leading-relaxed text-warn">
              No thesis yet for {withoutThesis.map((h) => h.symbol).join(", ")} — added after the
              brief was written. The analyst will say so.
            </p>
          ) : null}

          <Part title="Notes" text={b.notes} />
        </div>
      )}
    </div>
  );
}

function Timeline({ brief, struck }: { brief: Brief; struck: string }) {
  const end = horizonEnd(brief, struck);
  const progress = horizonProgress(brief, struck);
  const daysLeft = end ? Math.ceil((new Date(end).getTime() - Date.now()) / 86_400_000) : null;

  return (
    <Section title="Timeline">
      <dl className="flex flex-wrap gap-x-8 gap-y-2 text-detail">
        <div>
          <dt className="text-meta text-ink-subtle">Struck</dt>
          <dd className="text-ink">{formatDate(struck)}</dd>
        </div>
        <div>
          <dt className="text-meta text-ink-subtle">Horizon</dt>
          <dd className="text-ink">
            {brief.horizonMonths === null
              ? "Not set"
              : `${brief.horizonMonths} ${brief.horizonMonths === 1 ? "month" : "months"}`}
          </dd>
        </div>
        <div>
          <dt className="text-meta text-ink-subtle">Judge it by</dt>
          <dd className="text-ink">{end ? formatDate(end) : "Not set"}</dd>
        </div>
      </dl>
      {progress !== null && daysLeft !== null ? (
        <div className="mt-3 flex max-w-lg items-center gap-3">
          <Meter value={progress * 100} tone={progress >= 1 ? "warn" : "accent"} label="Horizon elapsed" />
          <span className="shrink-0 text-meta tabular-nums text-ink-muted">
            {Math.round(progress * 100)}% through ·{" "}
            {daysLeft > 0 ? `${daysLeft} days left` : "horizon reached"}
          </span>
        </div>
      ) : null}
    </Section>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-line px-6 py-5">
      <h3 className="text-body font-semibold tracking-tight text-ink">{title}</h3>
      <div className="mt-2 max-w-[72ch]">{children}</div>
    </section>
  );
}

function Part({ title, text }: { title: string; text: string }) {
  if (!text.trim()) return null;
  return (
    <Section title={title}>
      <Prose text={text} />
    </Section>
  );
}

function PointList({
  title,
  sign,
  tone,
  items,
}: {
  title: string;
  sign: string;
  tone: string;
  items: string[];
}) {
  if (!items.length) return null;
  return (
    <div className="mt-2.5">
      <div className={cn("text-meta font-medium tracking-wide", tone)}>{title}</div>
      <ul className="mt-1 space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-detail leading-relaxed text-ink-muted">
            <span aria-hidden className={cn("w-2 shrink-0 font-mono", tone)}>
              {sign}
            </span>
            <span className="min-w-0">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// --- drafting ----------------------------------------------------------------

function DraftPanel({
  list,
  refining,
  pending,
  error,
  onDraft,
  onCancel,
}: {
  list: WatchlistSummary;
  refining: boolean;
  pending: boolean;
  error: string | null;
  onDraft: (hint: string) => void;
  onCancel: () => void;
}) {
  const [hint, setHint] = useState(list.description ?? "");

  return (
    <div className="max-w-3xl space-y-5 px-6 py-6">
      <div>
        <h2 className="font-serif text-title tracking-tight text-ink">
          {refining ? "Refine the brief with the analyst" : "Draft a brief with the analyst"}
        </h2>
        <p className="mt-2 text-detail leading-relaxed text-ink-muted">
          Tell it why you struck this basket — the theme, the horizon, what you expect. It writes the
          motive, timeline, what working and failing look like, and a case for and against each
          holding, searching the news for names it needs to. {refining ? "It keeps what is already written and fills the gaps. " : ""}
          You review the draft before anything is saved.
        </p>
      </div>

      {!isConfigured() ? (
        <p className="rounded-md border border-line bg-sunken px-3 py-2.5 text-detail text-ink-muted">
          Drafting needs an OpenAI key: set <code className="font-mono text-ink">{KEY_SETUP.keyVar}</code> in{" "}
          <code className="font-mono text-ink">{KEY_SETUP.file}</code> and restart the dev server.
        </p>
      ) : null}

      <Field label="What is this basket for?" htmlFor="brief-hint">
        <textarea
          id="brief-hint"
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          rows={5}
          disabled={pending}
          placeholder="e.g. Defence and capital goods names that benefit from the order pipeline. Hold 18 months, cut anything that loses 15%."
          className={cn(FieldStyle(), "resize-y")}
        />
      </Field>

      {error ? <p className="text-detail text-loss">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <button
          type="button"
          onClick={() => onDraft(hint)}
          disabled={pending || !isConfigured()}
          className={cn(ActionStyle(), (pending || !isConfigured()) && "opacity-50")}
        >
          {pending ? "Drafting…" : refining ? "Refine" : "Draft"}
        </button>
        <button type="button" onClick={onCancel} disabled={pending} className={ActionStyle({ variant: "quiet" })}>
          Cancel
        </button>
        {pending ? (
          <span className="text-meta text-ink-subtle" role="status">
            Searching and writing — usually under a minute.
          </span>
        ) : null}
      </div>
    </div>
  );
}
