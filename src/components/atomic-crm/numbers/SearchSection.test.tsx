import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { StoryWrapper } from "@/test/StoryWrapper";

import { addDays, shopDayKey } from "../operations/shopTime";
import { SearchConsoleSyncError } from "../providers/commons/searchConsoleSync";
import { numbersRanges } from "./periods";
import { SearchSection } from "./SearchSection";

const EMAIL = "lab-crm@lab-crm.iam.gserviceaccount.com";

const renderSection = (
  data: Record<string, unknown[]>,
  syncSearchConsole: () => Promise<unknown>,
) =>
  render(
    <StoryWrapper
      data={{
        search_console_daily: [],
        search_console_queries: [],
        search_console_pages: [],
        ...data,
      }}
      dataProvider={{ syncSearchConsole } as never}
    >
      <SearchSection ranges={numbersRanges("30d")} vs="vs the 30 days before" />
    </StoryWrapper>,
  );

describe("Google search", () => {
  it("walks through sharing Search Console with the CRM, with the email to add", async () => {
    // Arrange
    const notShared = () =>
      Promise.reject(
        new SearchConsoleSyncError(
          "Search Console has not shared the shop's website with the CRM yet.",
          "needs_access",
          EMAIL,
        ),
      );

    // Act
    await renderSection({}, notShared);

    // Assert
    await expect
      .element(page.getByText("Connect Google Search Console"))
      .toBeVisible();
    await expect.element(page.getByText(EMAIL)).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: /users and permissions/i }))
      .toHaveAttribute(
        "href",
        "https://search.google.com/search-console/users",
      );
  });

  it("shows clicks and the searches people used once Google's numbers are in", async () => {
    // Arrange
    const yesterday = addDays(shopDayKey(new Date()), -1);
    const syncedAt = new Date().toISOString();

    // Act
    await renderSection(
      {
        search_console_daily: [
          {
            id: 1,
            day: yesterday,
            clicks: 12,
            impressions: 300,
            position: 7.5,
            synced_at: syncedAt,
          },
        ],
        search_console_queries: [
          {
            id: 1,
            day: yesterday,
            query: "window tint fort st john",
            clicks: 9,
            impressions: 120,
            position: 4,
            synced_at: syncedAt,
          },
        ],
      },
      () => Promise.resolve({ site: "sc-domain:thelabfsj.ca" }),
    );

    // Assert
    await expect.element(page.getByText("Clicks from Google")).toBeVisible();
    await expect
      .element(page.getByText("window tint fort st john"))
      .toBeVisible();
    await expect.element(page.getByText("4%", { exact: true })).toBeVisible();
  });
});
