import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ActionStyle } from "@/components/ui/primitives";
import { cn } from "@/lib/format";
import type { SymbolMatch } from "@stealth/shared";
import { searchSymbols } from "@/services/market-service";
import { addSymbol } from "@/services/watchlist-service";
import { basketKey } from "./keys";

type SearchState = "idle" | "searching" | "done";

export function AddSymbol({ basketId }: { basketId: string }) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<SymbolMatch[]>([]);
  const [state, setState] = useState<SearchState>("idle");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [selected, setSelected] = useState<SymbolMatch | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const add = useMutation({
    mutationFn: (input: Parameters<typeof addSymbol>[1]) => addSymbol(basketId, input),
    onSuccess: ({ warning }) => {
      // A row that went in without a baseline is still a row; say so and clear
      // the box, rather than treating it as a failed add.
      if (warning) setNotice(warning);
      setSelected(null);
      setQuery("");
      setMatches([]);
      setState("idle");
      setQuantity("1");
      void queryClient.invalidateQueries({ queryKey: basketKey(basketId) });
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : "Could not add that symbol."),
  });
  const pending = add.isPending;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (selected || q.length < 2) {
      setMatches([]);
      setState("idle");
      return;
    }

    setState("searching");
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setMatches(await searchSymbols(q, controller.signal));
        setHighlighted(0);
        setOpen(true);
        setState("done");
      } catch {
        if (!controller.signal.aborted) {
          setMatches([]);
          setState("done");
        }
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, selected]);

  function pick(match: SymbolMatch) {
    setSelected(match);
    setQuery(match.symbol);
    setOpen(false);
    setError(null);
  }

  function clear() {
    setSelected(null);
    setQuery("");
    setMatches([]);
    setState("idle");
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open || !matches.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => (h + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => (h - 1 + matches.length) % matches.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(matches[highlighted]);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    // A symbol typed in full and never picked from the list is still a valid
    // request — the server resolves it against Yahoo either way.
    const typed = query.trim().toUpperCase();
    const target = selected ?? (typed ? { symbol: typed, exchange: "NSE", name: null } : null);
    if (!target) {
      setError("Type or pick a symbol first.");
      return;
    }
    const qty = Number(quantity);
    if (!(qty > 0)) {
      setError("Quantity must be positive.");
      return;
    }

    add.mutate({
      symbol: target.symbol,
      exchange: target.exchange,
      name: target.name,
      quantity: qty,
    });
  }

  const showPanel = open && !selected && query.trim().length >= 2;

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-wrap items-center gap-2 border-b border-line bg-sunken px-6 py-3"
    >
      <div className="relative w-full max-w-sm">
        <SearchIcon />
        <input
          ref={inputRef}
          id="symbol-search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(null);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search a symbol — RELIANCE, TCS…"
          autoComplete="off"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls="symbol-results"
          aria-label="Symbol"
          className={cn(
            "w-full rounded-md border bg-surface py-2 pr-8 pl-9 text-body text-ink outline-none",
            selected ? "border-accent-line" : "border-line-strong focus:border-accent",
          )}
        />
        {selected || query ? (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear symbol"
            className="absolute top-1/2 right-1.5 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-ink-subtle transition hover:bg-sunken hover:text-ink"
          >
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              className="size-3"
            >
              <path d="m4 4 8 8M12 4l-8 8" />
            </svg>
          </button>
        ) : null}

        {showPanel ? (
          <ul
            id="symbol-results"
            role="listbox"
            className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-line bg-surface shadow-lift"
          >
            {state === "searching" && !matches.length ? (
              <li className="px-3 py-2.5 text-detail text-ink-subtle">Searching…</li>
            ) : null}
            {state === "done" && !matches.length ? (
              <li className="px-3 py-2.5 text-detail text-ink-subtle">
                No match. Press Add to try “{query.trim().toUpperCase()}” as an NSE ticker.
              </li>
            ) : null}
            {matches.map((m, i) => (
              <li key={m.yahooSymbol ?? `${m.exchange}:${m.symbol}`} role="option" aria-selected={i === highlighted}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(m);
                  }}
                  onMouseEnter={() => setHighlighted(i)}
                  className={cn(
                    "flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left",
                    i === highlighted ? "bg-accent-soft" : "hover:bg-sunken",
                  )}
                >
                  <span className="font-mono text-body font-medium text-ink">{m.symbol}</span>
                  <span className="min-w-0 flex-1 truncate text-detail text-ink-muted">
                    {m.name ?? ""}
                  </span>
                  <span className="text-meta text-ink-subtle">{m.exchange}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* Qty rides inside its own bordered group so the label reads as part of
          the field rather than as floating page text. */}
      <div className="flex items-center gap-2 rounded-md border border-line-strong bg-surface pl-3 focus-within:border-accent">
        <label htmlFor="symbol-qty" className="text-meta text-ink-muted">
          Qty
        </label>
        <input
          id="symbol-qty"
          type="number"
          min="0"
          step="any"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="w-16 bg-transparent py-2 pr-3 text-body tabular-nums text-ink outline-none"
        />
      </div>

      <button type="submit" disabled={pending} className={cn(ActionStyle(), pending && "opacity-60")}>
        {pending ? "Adding…" : "Add"}
      </button>

      {error || notice ? (
        <p
          className={cn(
            "flex w-full items-baseline gap-1.5 text-detail",
            error ? "text-loss" : "text-warn",
          )}
        >
          <span aria-hidden>•</span>
          {error ?? notice}
        </p>
      ) : null}
    </form>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle"
    >
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5 14 14" strokeLinecap="round" />
    </svg>
  );
}
