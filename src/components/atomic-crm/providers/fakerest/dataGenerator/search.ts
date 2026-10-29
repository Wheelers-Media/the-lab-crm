import { datatype } from "faker/locale/en_US";

import type {
  SearchDayRow,
  SearchPageRow,
  SearchQueryRow,
} from "../../../numbers/searchModel";
import { addDays, shopDayKey } from "../../../operations/shopTime";

// About 16 months, as much as Search Console keeps
const DAYS = 480;
// Search phrases and pages per day are kept for the last half year
const DETAIL_DAYS = 180;

// What a small shop in Fort St. John is found for: its name, its services
// in town, and a few broader searches it shows for but rarely wins.
const QUERIES: Array<{
  query: string;
  share: number;
  ctr: number;
  spot: number;
}> = [
  { query: "the lab fsj", share: 0.06, ctr: 0.45, spot: 1.2 },
  { query: "the lab fort st john", share: 0.04, ctr: 0.38, spot: 1.5 },
  { query: "window tint fort st john", share: 0.12, ctr: 0.09, spot: 4.8 },
  { query: "ceramic coating fort st john", share: 0.08, ctr: 0.07, spot: 6.2 },
  { query: "car detailing fort st john", share: 0.14, ctr: 0.05, spot: 8.4 },
  { query: "remote starter fort st john", share: 0.06, ctr: 0.04, spot: 9.1 },
  { query: "duramax delete kit", share: 0.18, ctr: 0.008, spot: 24.5 },
  { query: "light bar install near me", share: 0.1, ctr: 0.02, spot: 14.2 },
  { query: "ppf cost", share: 0.12, ctr: 0.005, spot: 31.7 },
  { query: "truck tuning bc", share: 0.1, ctr: 0.01, spot: 18.9 },
];

const PAGES: Array<{ path: string; share: number }> = [
  { path: "/", share: 0.45 },
  { path: "/pages/window-tint", share: 0.18 },
  { path: "/pages/ceramic-coating", share: 0.12 },
  { path: "/pages/detailing", share: 0.12 },
  { path: "/collections/parts", share: 0.13 },
];

const around = (n: number) =>
  Math.max(0, Math.round(n * datatype.float({ min: 0.7, max: 1.3 })));

/** Daily Google search figures for the demo, with phrases and pages for recent days. */
export const generateSearch = (): {
  daily: SearchDayRow[];
  queries: SearchQueryRow[];
  pages: SearchPageRow[];
} => {
  const today = shopDayKey(new Date());
  const syncedAt = new Date().toISOString();
  const daily: SearchDayRow[] = [];
  const queries: SearchQueryRow[] = [];
  const pages: SearchPageRow[] = [];
  // Google reports with a two day delay
  for (let i = 2; i < DAYS; i++) {
    const day = addDays(today, -i);
    // Found more often as the site gets older
    const shown = around(90 * (1 - (i / DAYS) * 0.5));
    let clicks = 0;
    let weighted = 0;
    for (const q of QUERIES) {
      const impressions = around(shown * q.share);
      const qClicks = Math.min(impressions, around(impressions * q.ctr));
      const position = Math.max(
        1,
        q.spot * datatype.float({ min: 0.85, max: 1.15 }),
      );
      clicks += qClicks;
      weighted += position * impressions;
      if (i < DETAIL_DAYS && impressions > 0)
        queries.push({
          id: queries.length + 1,
          day,
          query: q.query,
          clicks: qClicks,
          impressions,
          position: Math.round(position * 100) / 100,
          synced_at: syncedAt,
        });
    }
    if (i < DETAIL_DAYS)
      for (const p of PAGES) {
        const impressions = around(shown * p.share);
        if (!impressions) continue;
        pages.push({
          id: pages.length + 1,
          day,
          page: `https://thelabfsj.ca${p.path}`,
          clicks: Math.min(impressions, around(clicks * p.share)),
          impressions,
          position: Math.round((weighted / Math.max(1, shown)) * 100) / 100,
          synced_at: syncedAt,
        });
      }
    daily.push({
      id: daily.length + 1,
      day,
      clicks,
      impressions: shown,
      position: shown ? Math.round((weighted / shown) * 100) / 100 : 0,
      synced_at: syncedAt,
    });
  }
  return { daily, queries, pages };
};
