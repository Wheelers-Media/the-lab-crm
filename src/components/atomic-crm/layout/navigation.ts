// One map of the app's pages, shared by the desktop header and the phone tab
// bar, so the two can never disagree about what is where or what is active.
//
// The order follows the shop's day: what is on today (Home, Calendar, Shop
// floor), the work in progress (Jobs), the people (Customers), then the store
// and the numbers behind it.
import {
  BarChart3,
  Building2,
  CalendarDays,
  HelpCircle,
  Home,
  KanbanSquare,
  ListTodo,
  Package,
  Receipt,
  Star,
  Settings,
  ShoppingCart,
  Users,
  Wrench,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { matchPath } from "react-router";

export type NavIcon = ComponentType<SVGProps<SVGSVGElement>>;

export interface NavPage {
  to: string;
  label: string;
  /** One line under the label in menus: what the page is for. */
  hint: string;
  Icon: NavIcon;
  /** Route patterns that count as being on this page. */
  match: string[];
}

export interface NavGroup {
  label: string;
  pages: NavPage[];
}

export const PAGES = {
  home: {
    to: "/",
    label: "Home",
    hint: "Today's money, bookings and what needs doing",
    Icon: Home,
    match: ["/"],
  },
  calendar: {
    to: "/calendar",
    label: "Calendar",
    hint: "Drop-offs and Eric's bookings",
    Icon: CalendarDays,
    match: ["/calendar", "/appointments/*"],
  },
  shopFloor: {
    to: "/shop-floor",
    label: "Shop floor",
    hint: "In the bay, waiting on parts, ready for pickup",
    Icon: Wrench,
    match: ["/shop-floor"],
  },
  jobs: {
    to: "/deals",
    label: "Jobs",
    hint: "Requests, quotes and booked work",
    Icon: KanbanSquare,
    match: ["/deals/*", "/quotes/*"],
  },
  customers: {
    to: "/contacts",
    label: "Customers",
    hint: "Everyone who has called, booked or bought",
    Icon: Users,
    match: ["/contacts/*"],
  },
  businesses: {
    to: "/companies",
    label: "Businesses",
    hint: "Fleets and commercial accounts",
    Icon: Building2,
    match: ["/companies/*"],
  },
  tasks: {
    to: "/tasks",
    label: "Tasks",
    hint: "Follow-ups and reminders",
    Icon: ListTodo,
    match: ["/tasks/*"],
  },
  orders: {
    to: "/orders",
    label: "Orders",
    hint: "Shopify orders and deposits",
    Icon: Receipt,
    match: ["/orders/*"],
  },
  reviews: {
    to: "/reviews",
    label: "Ask for reviews",
    hint: "Recent customers to text in the evening",
    Icon: Star,
    match: ["/reviews"],
  },
  carts: {
    to: "/shopify_checkouts",
    label: "Abandoned carts",
    hint: "Call or text to recover",
    Icon: ShoppingCart,
    match: ["/shopify_checkouts/*"],
  },
  packages: {
    to: "/packages",
    label: "Packages and products",
    hint: "The Shopify catalog, prices and stock",
    Icon: Package,
    match: ["/packages/*"],
  },
  numbers: {
    to: "/numbers",
    label: "Numbers",
    hint: "Sales, trends, customers, leads and stock",
    Icon: BarChart3,
    match: ["/numbers"],
  },
  help: {
    to: "/help",
    label: "How it works",
    hint: "The life of a job and where to find things",
    Icon: HelpCircle,
    match: ["/help"],
  },
  settings: {
    to: "/settings",
    label: "Settings",
    hint: "Profile, team and app",
    Icon: Settings,
    match: ["/settings", "/profile", "/sales/*"],
  },
} satisfies Record<string, NavPage>;

export const isOnPage = (page: NavPage, pathname: string): boolean =>
  page.match.some((pattern) => matchPath(pattern, pathname) != null);

export const isInGroup = (group: NavGroup, pathname: string): boolean =>
  group.pages.some((page) => isOnPage(page, pathname));

/**
 * What an area of the shop is called in colour. One hue per area, used for the
 * sidebar icons, the active bar and the header label, so Eric learns "green is
 * the bay, orange is money" once and it holds on every screen. The values are
 * the --area-* tokens in index.css.
 */
export type Area = "shop" | "sales" | "people" | "store" | "insights" | "admin";

export interface SidebarGroup {
  id: string;
  label: string;
  area: Area;
  pages: NavPage[];
}

/** Always visible at the top of the sidebar: the two pages used all day. */
export const SIDEBAR_PINNED: NavPage[] = [PAGES.home, PAGES.calendar];

/** Drawers, in the order the shop's day runs. Each opens and closes. */
export const SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    id: "shop",
    label: "In the shop",
    area: "shop",
    pages: [PAGES.shopFloor, PAGES.tasks],
  },
  { id: "sales", label: "Sales", area: "sales", pages: [PAGES.jobs] },
  {
    id: "people",
    label: "Customers",
    area: "people",
    pages: [PAGES.customers, PAGES.businesses],
  },
  {
    id: "store",
    label: "Store",
    area: "store",
    pages: [PAGES.orders, PAGES.reviews, PAGES.carts, PAGES.packages],
  },
  {
    id: "insights",
    label: "Insights",
    area: "insights",
    pages: [PAGES.numbers],
  },
  { id: "help", label: "Help", area: "admin", pages: [PAGES.help] },
];

/** Settings sits apart at the foot of the sidebar. */
export const SIDEBAR_FOOT: NavPage = PAGES.settings;

/** The area a path belongs to, for the header label and colour. */
export const areaOf = (pathname: string): { area: Area; label: string } => {
  if (isOnPage(PAGES.home, pathname)) return { area: "shop", label: "Home" };
  if (isOnPage(PAGES.calendar, pathname))
    return { area: "shop", label: "Calendar" };
  const group = SIDEBAR_GROUPS.find((g) => isInGroup(g, pathname));
  if (group) return { area: group.area, label: group.label };
  return { area: "admin", label: "Settings" };
};

/** The phone's tab bar: four pages and More. Calendar is always a tap away. */
export const PHONE_TABS: NavPage[] = [
  PAGES.home,
  PAGES.calendar,
  PAGES.jobs,
  PAGES.customers,
];

/** Everything else, grouped the way the work is, in the More sheet. */
export const PHONE_MORE: NavGroup[] = [
  { label: "In the shop", pages: [PAGES.shopFloor, PAGES.tasks] },
  { label: "Insights", pages: [PAGES.numbers] },
  {
    label: "Store",
    pages: [PAGES.orders, PAGES.reviews, PAGES.carts, PAGES.packages],
  },
  { label: "Accounts", pages: [PAGES.businesses, PAGES.help, PAGES.settings] },
];
