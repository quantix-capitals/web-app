/**
 * An analyst run, as a document and as context for the next run.
 *
 * **How a run is kept.** Every run is stored as the structured `Report` the page
 * renders from, *and* as markdown rendered from that report in the same write.
 * Not HTML: a stored HTML snapshot freezes one day's styling, cannot follow the
 * theme, cannot be diffed against the next run, and puts model-written markup
 * one `innerHTML` away from the page. The report is data, so an old run
 * re-renders its tables and charts with today's components; the markdown is the
 * portable copy — what a download hands over and what reads cleanly anywhere.
 *
 * **How a run becomes context.** The next run is not handed the markdown. It is
 * handed `PriorRun`: the calls, the scores, what was expected, how each holding
 * sat against the brief, and what the user argued — the state that lets the
 * agent say "I told you to trim this in March and you still hold it", in a
 * shape it cannot misread.
 */

import { formatDate, formatLevelPercent, formatPercent } from "@/lib/format";
import type {
  BriefFit,
  Exchange,
  HoldingReview,
  PriorRun,
  Report,
  RunRecord,
  ThesisStatus,
  Verdict,
} from "./types";

export function runLabel(seq: number): string {
  return `r${seq}`;
}

export const VERDICT_WORD: Record<Verdict, string> = {
  add: "Add",
  keep: "Keep",
  trim: "Trim",
  sell: "Sell",
};

export const THESIS_WORD: Record<ThesisStatus, string> = {
  on_track: "On track",
  mixed: "Mixed",
  off_track: "Off track",
  no_brief: "No brief to judge against",
};

export const FIT_WORD: Record<BriefFit, string> = {
  fits: "Fits the brief",
  drifting: "Drifting from the brief",
  breaks: "Breaks the brief",
  not_in_brief: "Not in the brief",
};

/** The name a downloaded run lands under. */
export function runFilename(basketName: string, label: string): string {
  return `${slug(basketName)}-${label}.md`;
}

export function briefFilename(basketName: string): string {
  return `${slug(basketName)}-brief.md`;
}

function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "basket"
  );
}

/** Hands a markdown document to the browser as a file. */
export function downloadMarkdown(filename: string, markdown: string): void {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// --- reading stored reports --------------------------------------------------

/**
 * A stored report, with every field a later version of the agent added filled
 * in. A log is only worth keeping if its old entries keep rendering.
 */
export function normalizeReport(raw: unknown): Report {
  const r = (raw ?? {}) as Partial<Report>;
  return {
    at: r.at ?? new Date(0).toISOString(),
    regime: r.regime ?? { label: "Market state not recorded", trendUp: null, ret3m: null, tone: "neutral" },
    holdings: (r.holdings ?? []).map((h) => ({
      ...h,
      findings: h.findings ?? [],
      sources: h.sources ?? [],
      outlook: h.outlook ?? null,
      replacement: h.replacement ?? null,
      cashInstead: h.cashInstead ?? null,
      previous: h.previous ?? null,
      briefFit: h.briefFit ?? { status: "not_in_brief", note: "" },
      plan: h.plan ?? null,
    })),
    sectors: r.sectors ?? [],
    summary: r.summary ?? "",
    counts: r.counts ?? { add: 0, keep: 0, trim: 0, sell: 0 },
    skipped: r.skipped ?? [],
    unclassified: r.unclassified ?? [],
    thesis: r.thesis ?? { status: "no_brief", assessment: "" },
    additions: r.additions ?? [],
  };
}

/** What one earlier run contributes to the next one's context. */
export function toPriorRun(run: RunRecord): PriorRun {
  return {
    id: run.id,
    label: run.label,
    at: run.at,
    regime: run.report.regime.label,
    summary: run.report.summary,
    thesis: run.report.thesis,
    verdicts: run.report.holdings.map((h) => ({
      symbol: h.symbol,
      verdict: h.verdict,
      score: h.score,
      reason: h.headline,
      replacement: h.replacement?.symbol ?? null,
      sinceEntry: h.signals.sinceEntry,
      outlook: h.outlook,
      briefFit: h.briefFit,
    })),
    additions: run.report.additions.map((a) => a.symbol),
    exchanges: run.exchanges,
  };
}

// --- markdown ----------------------------------------------------------------

function pct(value: number | null, digits = 1): string {
  return value === null ? "—" : formatPercent(value, digits);
}

function cell(text: string): string {
  return text.replace(/\|/g, "/").replace(/\s*\n+\s*/g, " ").trim() || "—";
}

function planCell(h: HoldingReview): string {
  if (!h.plan || (h.plan.target === null && h.plan.stop === null)) return "—";
  return `${pct(h.plan.target, 0)} / ${pct(h.plan.stop, 0)}`;
}

export function renderRunMarkdown(
  report: Report,
  meta: {
    basketName: string;
    label: string;
    model: string | null;
    contextLabels: string[];
    briefIncluded: boolean;
    exchanges: Exchange[];
  },
): string {
  const out: string[] = [];

  out.push(`# ${meta.basketName} — analyst run ${meta.label}`);
  out.push(
    `*${formatDate(report.at)} · ${report.at} · ${report.regime.label}${meta.model ? ` · ${meta.model}` : ""}*`,
  );
  out.push(
    [
      "**Context given**",
      `- Brief: ${meta.briefIncluded ? "included" : "not included"}`,
      `- Previous runs: ${meta.contextLabels.length ? meta.contextLabels.join(", ") : "none"}`,
    ].join("\n"),
  );

  out.push(`## Summary\n\n${report.summary}`);

  if (report.thesis.status !== "no_brief" || report.thesis.assessment) {
    out.push(
      `## Against the brief\n\n**${THESIS_WORD[report.thesis.status]}.** ${report.thesis.assessment}`,
    );
  }

  const counts = (Object.keys(VERDICT_WORD) as Verdict[])
    .filter((v) => report.counts[v])
    .map((v) => `${report.counts[v]} ${v}`)
    .join(" · ");

  out.push(
    [
      `## Calls${counts ? ` — ${counts}` : ""}`,
      [
        "| Symbol | Call | Score | Screen | Last run | Since entry | Target / stop | Brief | Instead buy | Reason |",
        "| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |",
        ...report.holdings.map(
          (h) =>
            `| ${h.symbol} | ${VERDICT_WORD[h.verdict]} | ${h.score} | ${h.screen} | ${
              h.previous ? `${VERDICT_WORD[h.previous.verdict]} ${h.previous.score}` : "—"
            } | ${pct(h.signals.sinceEntry)} | ${planCell(h)} | ${FIT_WORD[h.briefFit.status]} | ${
              h.replacement?.symbol ?? "—"
            } | ${cell(h.headline)} |`,
        ),
      ].join("\n"),
    ].join("\n\n"),
  );

  if (report.additions.length) {
    out.push(
      [
        "## Ideas to add",
        report.additions
          .map((a) => `- **${a.symbol}** — ${a.name}, ${a.sector}, screen ${a.score}. ${a.rationale}`)
          .join("\n"),
      ].join("\n\n"),
    );
  }

  const outlooks = report.holdings.filter((h) => h.outlook);
  if (outlooks.length) {
    out.push(
      [
        "## What I expect to matter",
        outlooks
          .map((h) => {
            const cites = h.sources
              .map((s) => `[${s.title}](${s.url})${s.published ? ` (${s.published})` : ""}`)
              .join(", ");
            return `- **${h.symbol}:** ${h.outlook}${cites ? `\n  Sources: ${cites}` : ""}`;
          })
          .join("\n"),
      ].join("\n\n"),
    );
  }

  out.push(
    [
      "## Holdings in detail",
      ...report.holdings.map((h) => {
        const lines = [`### ${h.symbol} — ${VERDICT_WORD[h.verdict]}, ${h.score}/100`, h.headline];
        if (h.briefFit.note) lines.push(`*${FIT_WORD[h.briefFit.status]}:* ${h.briefFit.note}`);
        for (const [title, pull] of [
          ["For", "for"],
          ["Against", "against"],
          ["Context", "context"],
        ] as const) {
          const items = h.findings.filter((f) => f.pull === pull);
          if (!items.length) continue;
          lines.push(
            [
              `**${title}**`,
              ...items.map(
                (f) =>
                  `- ${f.label}${f.weight ? ` (${f.weight > 0 ? "+" : ""}${f.weight})` : ""}${
                    f.basis === "measured" ? "" : ` [${f.basis}]`
                  }: ${f.detail}`,
              ),
            ].join("\n"),
          );
        }
        if (h.replacement) {
          lines.push(`**Instead buy ${h.replacement.symbol}** (+${h.replacement.edge}): ${h.replacement.rationale}`);
        } else if (h.cashInstead) {
          lines.push(`**Cash instead:** ${h.cashInstead}`);
        }
        return lines.join("\n\n");
      }),
    ].join("\n\n"),
  );

  if (report.sectors.length) {
    out.push(
      [
        "## Sector weights",
        [
          "| Sector | Weight |",
          "| --- | ---: |",
          ...report.sectors.map((s) => `| ${s.sector} | ${formatLevelPercent(s.weight)} |`),
        ].join("\n"),
      ].join("\n\n"),
    );
  }

  if (report.skipped.length) {
    out.push(`## Not judged\n\nNo price data at all: ${report.skipped.join(", ")}.`);
  }

  if (meta.exchanges.length) {
    out.push(
      [
        "## Questions put to me",
        meta.exchanges
          .map((x) => `**Q (${formatDate(x.at)}):** ${x.question}\n\n**A:** ${x.answer}`)
          .join("\n\n"),
      ].join("\n\n"),
    );
  }

  return out.join("\n\n") + "\n";
}
