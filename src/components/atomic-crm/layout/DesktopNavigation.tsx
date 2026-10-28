import { ChevronDown } from "lucide-react";
import { NavigationMenu as Menu } from "radix-ui";
import { Link, useLocation } from "react-router";
import { cn } from "@/lib/utils";

import {
  DESKTOP_NAV,
  isInGroup,
  isNavGroup,
  isOnPage,
  type NavGroup,
  type NavPage,
} from "./navigation";

/**
 * The desktop header's links. Everyday pages are one click; the customer
 * accounts and the store open from a hover menu, so the bar stays short
 * enough to read at a glance. Radix gives the menus keyboard support and
 * opens them on hover and on click alike.
 */
export const DesktopNavigation = () => {
  const { pathname } = useLocation();
  return (
    <Menu.Root delayDuration={80} aria-label="Main" className="relative">
      <Menu.List className="flex items-center">
        {DESKTOP_NAV.map((item) =>
          isNavGroup(item) ? (
            <GroupItem
              key={item.label}
              group={item}
              active={isInGroup(item, pathname)}
              pathname={pathname}
            />
          ) : (
            <Menu.Item key={item.to}>
              <Menu.Link asChild active={isOnPage(item, pathname)}>
                <Link
                  to={item.to}
                  className="lab-nav-link"
                  aria-current={isOnPage(item, pathname) ? "page" : undefined}
                >
                  {item.label}
                </Link>
              </Menu.Link>
            </Menu.Item>
          ),
        )}
      </Menu.List>
    </Menu.Root>
  );
};

const GroupItem = ({
  group,
  active,
  pathname,
}: {
  group: NavGroup;
  active: boolean;
  pathname: string;
}) => (
  <Menu.Item className="relative">
    <Menu.Trigger
      className="lab-nav-link group gap-1 cursor-default bg-transparent"
      aria-current={active ? "page" : undefined}
    >
      {group.label}
      <ChevronDown
        aria-hidden="true"
        className="size-3.5 transition-transform duration-300 group-data-[state=open]:rotate-180 motion-reduce:transition-none"
      />
    </Menu.Trigger>
    <Menu.Content
      className={cn(
        "absolute left-1/2 top-full z-50 mt-1 w-80 -translate-x-1/2",
        "rounded-lg border border-border bg-popover p-1.5 text-popover-foreground",
        "shadow-[0_24px_48px_-16px_rgba(0,0,0,0.6)]",
        "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
      )}
    >
      <ul className="flex flex-col">
        {group.pages.map((page) => (
          <li key={page.to}>
            <GroupLink page={page} active={isOnPage(page, pathname)} />
          </li>
        ))}
      </ul>
    </Menu.Content>
  </Menu.Item>
);

const GroupLink = ({ page, active }: { page: NavPage; active: boolean }) => {
  const { Icon } = page;
  return (
    <Menu.Link asChild active={active}>
      <Link
        to={page.to}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-start gap-3 rounded-md px-3 py-2.5 no-underline outline-none transition-colors",
          "hover:bg-accent focus-visible:bg-accent",
          active && "bg-accent",
        )}
      >
        <span
          className={cn(
            "mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-muted",
            active ? "text-[var(--lab-blue-text)]" : "text-muted-foreground",
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium text-foreground">
            {page.label}
          </span>
          <span className="block text-xs leading-snug text-muted-foreground">
            {page.hint}
          </span>
        </span>
      </Link>
    </Menu.Link>
  );
};
