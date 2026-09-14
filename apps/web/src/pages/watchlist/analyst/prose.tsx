/**
 * The agent writes markdown-ish prose — paragraphs, `- ` bullets, `**bold**` —
 * and this renders exactly that subset and nothing else.
 *
 * A markdown library would be the obvious move and is the wrong one here: the
 * grammar is closed and four cases long, and pulling in a parser would add a
 * dependency, a sanitiser decision and an HTML injection surface to render bold
 * text in a sidebar.
 *
 * Links are in the list because the model puts them there. Told to cite its
 * sources it will write `([reuters.com](https://…))` mid-sentence whatever the
 * prompt says, and an unrendered one shows the reader a line of raw markdown.
 * Only `http` and `https` are turned into anchors — `javascript:` and `data:`
 * URLs render as text, because this text comes from a model that read the open
 * web and a link is the one thing in it that can act.
 *
 * No `dangerouslySetInnerHTML` anywhere: every span below is real DOM, so a
 * company name with an angle bracket in it stays a company name.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/format";

export function Prose({ text, className }: { text: string; className?: string }) {
  const blocks = text.split("\n\n").filter((b) => b.trim());

  return (
    <div className={cn("space-y-2.5 text-detail leading-relaxed text-ink-muted", className)}>
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        const bullets = lines.filter((l) => l.trimStart().startsWith("- "));

        // `## Heading`. Asked to lay out a case the model reaches for headings
        // whatever the prompt says, and an unrendered one puts literal hashes in
        // the panel. There is one size: this is a 380px column, and a hierarchy
        // of heading sizes inside a chat bubble is noise.
        const heading = /^(#{1,4})\s+(.*)$/.exec(block.trim());
        if (heading && lines.length === 1) {
          return (
            <p key={i} className="pt-1 text-detail font-semibold text-ink">
              {inline(heading[2])}
            </p>
          );
        }

        // A block is a list only if every line in it is one; a lead-in sentence
        // followed by bullets is two blocks, and is rendered as such.
        if (bullets.length && bullets.length === lines.length) {
          return (
            <ul key={i} className="space-y-1.5">
              {lines.map((line, j) => (
                <li key={j} className="flex gap-2">
                  <span aria-hidden className="mt-[0.6em] h-px w-2 shrink-0 bg-line-strong" />
                  <span className="min-w-0">{inline(line.trimStart().slice(2))}</span>
                </li>
              ))}
            </ul>
          );
        }

        if (bullets.length) {
          const lead = lines.filter((l) => !l.trimStart().startsWith("- "));
          return (
            <div key={i} className="space-y-1.5">
              <p>{inline(lead.join(" "))}</p>
              <ul className="space-y-1.5">
                {bullets.map((line, j) => (
                  <li key={j} className="flex gap-2">
                    <span aria-hidden className="mt-[0.6em] h-px w-2 shrink-0 bg-line-strong" />
                    <span className="min-w-0">{inline(line.trimStart().slice(2))}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        }

        return <p key={i}>{inline(block.replace(/\n/g, " "))}</p>;
      })}
    </div>
  );
}

/**
 * `**bold**` and `[text](url)`. Anything else is left as literal text.
 *
 * Exported because the verdict cards render single sentences written by the same
 * model — a finding, an outlook — and those carry the same inline citations the
 * chat does. One renderer, so a link is safe in both places or in neither.
 */
export function RichText({ text }: { text: string }) {
  return <>{inline(text)}</>;
}

const TOKEN = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g;
const LINK = /^\[([^\]]+)\]\(([^)\s]+)\)$/;

function inline(text: string): ReactNode[] {
  return text.split(TOKEN).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={i} className="font-semibold text-ink">
          {part.slice(2, -2)}
        </strong>
      );
    }

    const link = LINK.exec(part);
    if (link) {
      const [, label, href] = link;
      if (/^https?:\/\//i.test(href)) {
        return (
          <a
            key={i}
            href={href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-accent-ink underline-offset-2 hover:underline"
          >
            {label}
          </a>
        );
      }
      // Not a web link. Show the words, drop the destination.
      return <span key={i}>{label}</span>;
    }

    return <span key={i}>{part}</span>;
  });
}
