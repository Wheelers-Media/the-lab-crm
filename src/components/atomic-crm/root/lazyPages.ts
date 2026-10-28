// Pages loaded when they are first opened rather than with the app. Home,
// customers and jobs stay in the first download; the heavier screens
// (Numbers' charts, the calendar, the quote builder, the store, settings)
// arrive as their own files, so a phone on cellular shows Home sooner.
import { type ComponentType, lazy } from "react";

const page = <K extends string>(
  load: () => Promise<Record<K, ComponentType>>,
  name: K,
) => lazy(() => load().then((module) => ({ default: module[name] })));

export const NumbersPage = page(
  () => import("../numbers/NumbersPage"),
  "NumbersPage",
);
export const CalendarPage = page(
  () => import("../calendar/CalendarPage"),
  "CalendarPage",
);
export const ShopFloorPage = page(
  () => import("../shopfloor/ShopFloorPage"),
  "ShopFloorPage",
);
export const QuoteBuilderPage = page(
  () => import("../packages/QuoteBuilderPage"),
  "QuoteBuilderPage",
);
export const SettingsPage = page(
  () => import("../settings/SettingsPage"),
  "SettingsPage",
);
export const SettingsPageMobile = page(
  () => import("../settings/SettingsPageMobile"),
  "SettingsPageMobile",
);
export const ProfilePage = page(
  () => import("../settings/ProfilePage"),
  "ProfilePage",
);
export const ImportPage = page(
  () => import("../misc/ImportPage"),
  "ImportPage",
);
export const ChangelogPage = page(
  () => import("../misc/ChangelogPage"),
  "ChangelogPage",
);
export const ProductList = page(
  () => import("../packages/ProductList"),
  "ProductList",
);
export const MobileProductList = page(
  () => import("../packages/ProductList"),
  "MobileProductList",
);
export const ProductShow = page(
  () => import("../packages/ProductShow"),
  "ProductShow",
);

/** Route paths, kept here so the routes need no import of the pages. */
export const PAGE_PATHS = {
  numbers: "/numbers",
  calendar: "/calendar",
  shopFloor: "/shop-floor",
  quoteBuilder: "/quotes/:id",
  settings: "/settings",
  profile: "/profile",
  import: "/import",
  changelog: "/changelog",
} as const;
