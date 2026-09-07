import { Link, useLocation } from "react-router-dom";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Wordmark } from "@/components/brand";
import { Dot } from "@/components/ui/primitives";
import { cn } from "@/lib/format";
import { IconAgent, IconChevron, IconMenu } from "./nav-icons";
import { isActive, NAV, type NavItem } from "./nav";
import { getSnapshot, setCollapsed, subscribe } from "./sidebar-store";

/**
 * The persistent chrome: a rail that collapses to icons and expands to labels,
 * plus a mobile drawer over the same nav. Every route renders inside it.
 *
 * The rail sits on the sunken ground and the content on canvas, so the two are
 * told apart by surface as well as by the rule between them.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const collapsed = useSyncExternalStore(subscribe, getSnapshot);
  const [drawer, setDrawer] = useState(false);

  const toggle = useCallback(() => setCollapsed(!getSnapshot()), []);

  // ⌘/Ctrl-B mirrors what every editor with a sidebar already trained people to press.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "b" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggle();
      }
      if (e.key === "Escape") setDrawer(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  // A route change should not leave the drawer sitting open over the new page.
  useEffect(() => setDrawer(false), [pathname]);

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* ---------- desktop rail ---------- */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r border-line bg-sunken transition-[width] duration-200 ease-out md:flex",
          collapsed ? "w-[64px]" : "w-[232px]",
        )}
      >
        <SidebarBody collapsed={collapsed} pathname={pathname} onToggle={toggle} />
      </aside>

      {/* ---------- mobile drawer ---------- */}
      {drawer ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            aria-label="Close navigation"
            onClick={() => setDrawer(false)}
            className="absolute inset-0 bg-ink/25 backdrop-blur-sm"
          />
          <aside className="animate-rise absolute inset-y-0 left-0 flex w-[240px] flex-col border-r border-line bg-sunken">
            <SidebarBody
              collapsed={false}
              pathname={pathname}
              onNavigate={() => setDrawer(false)}
            />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-canvas">
        {/* Mobile-only bar — the rail is the desktop equivalent. */}
        <div className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3 md:hidden">
          <button
            onClick={() => setDrawer(true)}
            aria-label="Open navigation"
            className="rounded-md p-1.5 text-ink-muted hover:bg-sunken hover:text-ink"
          >
            <IconMenu />
          </button>
          <Wordmark />
        </div>
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

function SidebarBody({
  collapsed,
  pathname,
  onToggle,
  onNavigate,
}: {
  collapsed: boolean;
  pathname: string;
  onToggle?: () => void;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div
        className={cn(
          "flex h-[57px] shrink-0 items-center border-b border-line",
          collapsed ? "justify-center px-2" : "justify-between px-4",
        )}
      >
        <Wordmark compact={collapsed} />
        {onToggle && !collapsed ? (
          <button
            onClick={onToggle}
            aria-label="Collapse sidebar"
            title="Collapse sidebar (⌘B)"
            className="rounded-md p-1 text-ink-subtle transition hover:bg-canvas hover:text-ink"
          >
            <IconChevron className="size-4" />
          </button>
        ) : null}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {NAV.map((section, i) => (
          <div key={section.title} className="mb-4 last:mb-0">
            {collapsed ? (
              i > 0 ? <div className="mx-2 mb-2 h-px bg-line" /> : null
            ) : (
              <div className="mb-1 px-2.5 text-meta font-medium tracking-wide text-ink-subtle">
                {section.title}
              </div>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.href}>
                  <NavLink
                    item={item}
                    active={isActive(pathname, item)}
                    collapsed={collapsed}
                    onNavigate={onNavigate}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* The agent is the product, so its state lives in the chrome — visible from
          every route, not just the page that started a scan. */}
      <div className="shrink-0 border-t border-line p-2">
        {collapsed ? (
          <div className="flex flex-col items-center gap-1.5">
            <Link
              to="/momentum"
              title="Run a momentum scan"
              className="flex size-9 items-center justify-center rounded-md bg-accent text-on-accent transition hover:bg-accent-hover"
            >
              <IconAgent className="size-4" />
            </Link>
            {onToggle ? (
              <button
                onClick={onToggle}
                aria-label="Expand sidebar"
                title="Expand sidebar (⌘B)"
                className="rounded-md p-1.5 text-ink-subtle transition hover:bg-canvas hover:text-ink"
              >
                <IconChevron className="size-4 rotate-180" />
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <Link
              to="/momentum"
              onClick={onNavigate}
              className="flex items-center justify-center gap-2 rounded-md bg-accent px-3 py-2 text-body font-medium text-on-accent transition hover:bg-accent-hover"
            >
              <IconAgent className="size-4" />
              Run a scan
            </Link>
            <div className="mt-2 flex items-center gap-2 px-1.5 py-1 text-meta text-ink-subtle">
              <Dot tone="neutral" />
              <span>Agent offline</span>
              <span className="ml-auto font-mono">v0.1</span>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function NavLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      to={item.href}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center rounded-md text-body transition",
        collapsed ? "justify-center px-0 py-2" : "gap-2.5 px-2.5 py-2",
        active
          ? "bg-accent-soft font-medium text-accent-ink"
          : "text-ink-muted hover:bg-canvas hover:text-ink",
      )}
    >
      {active ? (
        <span className="absolute inset-y-1.5 left-0 w-0.5 bg-accent" />
      ) : null}
      <Icon className={cn("size-[18px] shrink-0", active && "text-accent")} />
      {collapsed ? null : (
        <>
          <span className="truncate">{item.label}</span>
          {item.badge ? (
            <span className="ml-auto text-meta tabular-nums text-ink-subtle">
              {item.badge}
            </span>
          ) : null}
        </>
      )}
    </Link>
  );
}
