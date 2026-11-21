import { ChevronDown, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useState, useSyncExternalStore, type CSSProperties } from "react";
import { Link, useLocation } from "react-router";
import { cn } from "@/lib/utils";

import { useConfigurationContext } from "../root/ConfigurationContext";
import {
  isInGroup,
  isOnPage,
  SIDEBAR_FOOT,
  SIDEBAR_GROUPS,
  SIDEBAR_PINNED,
  type Area,
  type NavPage,
} from "./navigation";

const WIDE = "(min-width: 1024px)";
const COLLAPSED_KEY = "lab.sidebar.collapsed";
const CLOSED_KEY = "lab.sidebar.closed";

/** Remembered per device. Storage can be blocked, so every access is guarded. */
const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* the sidebar still works for this visit */
  }
};

const subscribeWide = (notify: () => void) => {
  const mql = window.matchMedia(WIDE);
  mql.addEventListener("change", notify);
  return () => mql.removeEventListener("change", notify);
};
const useIsWide = () =>
  useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE).matches,
    () => true,
  );

/** Whether the sidebar is the narrow icon rail, and the switch for wide screens. */
export const useSidebarRail = () => {
  const wide = useIsWide();
  const [collapsed, setCollapsed] = useState(read(COLLAPSED_KEY) === "1");
  const toggle = () =>
    setCollapsed((c) => {
      write(COLLAPSED_KEY, c ? "0" : "1");
      return !c;
    });
  return { rail: !wide || collapsed, wide, toggle };
};

const areaStyle = (area: Area): CSSProperties =>
  ({ "--a": `var(--area-${area})` }) as CSSProperties;

/**
 * The desktop and tablet sidebar. Two pages stay pinned, the rest live in
 * colour-coded drawers that open and close (and are remembered). Below 1024px,
 * or when collapsed, it shrinks to an icon rail so an iPad keeps its width.
 */
export const Sidebar = ({
  rail,
  wide,
  onToggle,
}: {
  rail: boolean;
  wide: boolean;
  onToggle: () => void;
}) => {
  const { pathname } = useLocation();
  const { darkModeLogo, lightModeLogo, title } = useConfigurationContext();
  const [closed, setClosed] = useState<string[]>(() => {
    try {
      return JSON.parse(read(CLOSED_KEY) ?? "[]") as string[];
    } catch {
      return [];
    }
  });
  const toggleDrawer = (id: string) =>
    setClosed((list) => {
      const next = list.includes(id)
        ? list.filter((x) => x !== id)
        : [...list, id];
      write(CLOSED_KEY, JSON.stringify(next));
      return next;
    });

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-[var(--sidebar)]",
        "transition-[width] duration-200 motion-reduce:transition-none",
        rail ? "w-16" : "w-64",
      )}
    >
      <Link
        to="/"
        aria-label={`${title}, Home`}
        className="flex h-14 shrink-0 items-center gap-2 px-3 no-underline"
      >
        <img className="[.light_&]:hidden h-9" src={darkModeLogo} alt="" />
        <img className="[.dark_&]:hidden h-9" src={lightModeLogo} alt="" />
      </Link>

      <nav
        aria-label="Main"
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-2 pb-2"
      >
        <ul className="flex flex-col gap-0.5">
          {SIDEBAR_PINNED.map((page) => (
            <li key={page.to}>
              <Item page={page} area="shop" rail={rail} pathname={pathname} />
            </li>
          ))}
        </ul>

        {SIDEBAR_GROUPS.map((group) => {
          const open = rail || !closed.includes(group.id);
          const here = isInGroup(group, pathname);
          const panelId = `drawer-${group.id}`;
          return (
            <section
              key={group.id}
              style={areaStyle(group.area)}
              className="mt-1.5"
            >
              {rail ? (
                <div
                  aria-hidden="true"
                  className="mx-3 mb-1 h-0.5 rounded-full bg-[var(--a)] opacity-60"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => toggleDrawer(group.id)}
                  aria-expanded={open}
                  aria-controls={panelId}
                  className="flex h-9 w-full items-center gap-2 rounded-md px-3 text-left text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
                >
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-full bg-[var(--a)]"
                  />
                  <span className={cn("flex-1", here && "text-foreground")}>
                    {group.label}
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className={cn(
                      "size-3.5 transition-transform duration-200 motion-reduce:transition-none",
                      !open && "-rotate-90",
                    )}
                  />
                </button>
              )}
              <div
                id={panelId}
                className={cn(
                  "grid transition-[grid-template-rows] duration-200 motion-reduce:transition-none",
                  open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
              >
                <ul className="flex min-h-0 flex-col gap-0.5 overflow-hidden">
                  {group.pages.map((page) => (
                    <li key={page.to}>
                      <Item
                        page={page}
                        area={group.area}
                        rail={rail}
                        pathname={pathname}
                        hidden={!open}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          );
        })}
      </nav>

      <div className="flex flex-col gap-0.5 border-t border-border p-2">
        <Item
          page={SIDEBAR_FOOT}
          area="admin"
          rail={rail}
          pathname={pathname}
        />
        {wide ? (
          <button
            type="button"
            onClick={onToggle}
            aria-label={rail ? "Expand sidebar" : "Collapse sidebar"}
            title={rail ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-10 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition-colors pointer-coarse:h-11 hover:bg-accent hover:text-foreground"
          >
            {rail ? (
              <PanelLeftOpen className="size-5 shrink-0" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="size-5 shrink-0" aria-hidden="true" />
            )}
            {rail ? null : <span>Collapse</span>}
          </button>
        ) : null}
      </div>
    </aside>
  );
};

const Item = ({
  page,
  area,
  rail,
  pathname,
  hidden,
}: {
  page: NavPage;
  area: Area;
  rail: boolean;
  pathname: string;
  hidden?: boolean;
}) => {
  const { Icon } = page;
  const active = isOnPage(page, pathname);
  return (
    <Link
      to={page.to}
      style={areaStyle(area)}
      aria-current={active ? "page" : undefined}
      aria-label={rail ? page.label : undefined}
      title={rail ? page.label : page.hint}
      tabIndex={hidden ? -1 : undefined}
      className={cn(
        "relative flex h-10 items-center gap-3 rounded-md pointer-coarse:h-11 px-3 text-sm no-underline outline-none transition-colors",
        "hover:bg-accent focus-visible:bg-accent",
        active
          ? "bg-[color-mix(in_oklab,var(--a)_16%,transparent)] font-semibold text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {active ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-[var(--a)]"
        />
      ) : null}
      <Icon className="size-5 shrink-0 text-[var(--a)]" aria-hidden="true" />
      {rail ? null : <span className="truncate">{page.label}</span>}
    </Link>
  );
};
