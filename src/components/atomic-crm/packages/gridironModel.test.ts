import { describe, expect, it } from "vitest";

import type { Package } from "../types";
import {
  bumperRequest,
  finishVariant,
  gridironFits,
  gridironForTruck,
  titleYears,
} from "./gridironModel";
import { lineFromCatalog, quoteContext } from "./quoteModel";

// Danton Coleman's website request, as it arrived
const DANTON = {
  name: "Bumpers & Accessories - 2023 Ford F350",
  category: "gridiron",
  quote: {
    choices: [
      { label: "Engine Type", value: "6.7" },
      {
        label: "Gridiron bumper (if you want one)",
        value: "Front bumper: Full Tube",
      },
      { label: "Bumper finish", value: "Custom colour" },
      { label: "Install", value: "Install at THE LAB" },
    ],
  },
};
const f350 = quoteContext({
  name: DANTON.name,
  vehicle: {
    year: 2023,
    make: "Ford",
    model: "F350",
    engine: null,
    platform: null,
  },
});

const FINISHES = [
  { id: "black", title: "Black Powder Coat", price: 3749 },
  { id: "custom", title: "Custom Color Powder Coat", price: 4349 },
  { id: "liner", title: "Custom Color Bed Liner", price: 4349 },
];
let nextId = 1;
const listing = (title: string, extra: Partial<Package> = {}): Package =>
  ({
    id: nextId++,
    title,
    vendor: "Gridiron Bumper Corp.",
    category: "gridiron",
    kind: "package",
    status: "active",
    price: 3749,
    variants: FINISHES,
    ...extra,
  }) as unknown as Package;

// Real titles from the store
const STORE = [
  listing("2017-2022 Ford F250 - GRIDIRON - F550 Full Tube Winch Front Bumper"),
  listing("GRIDIRON 2017-2022 Ford F250-F550 Base Front Bumper"),
  listing("2017 Ford F250 - GRIDIRON - + -F450 Rear Bumper"),
  listing('2023-2026 Ford Super Duty 3" Valance', {
    vendor: "Gridiron Manufacturing",
  }),
  listing(
    "2019 Ram 2500 - GRIDIRON - + /3500/4500/5500 Full Tube Front Bumper",
  ),
  listing("2023-2025 Chevrolet - GRIDIRON - 2500/3500 Full Tube Front Bumper"),
  listing("Billet D-Rings"),
  listing("GBC Workwear Beanie"),
];

describe("bumperRequest", () => {
  it("reads the bumper, style and finish from the website form", () => {
    expect(bumperRequest(DANTON)).toEqual({
      position: "front",
      style: "full tube",
      isWinch: false,
      finish: "custom colour",
      summary: "Front bumper: Full Tube, Custom colour",
    });
  });

  it("is null for a job that is not about a bumper", () => {
    expect(
      bumperRequest({
        name: "Tuning - 2020 Ram 2500",
        category: "tuning",
        quote: { choices: [{ label: "Service", value: "Tuning" }] },
      }),
    ).toBeNull();
  });

  it("ignores a 'no bumper' answer", () => {
    expect(
      bumperRequest({
        name: "Accessories",
        quote: {
          choices: [
            { label: "Gridiron bumper (if you want one)", value: "No bumper" },
          ],
        },
      }),
    ).toBeNull();
  });
});

describe("Gridiron fitment", () => {
  it("reads open-ended years from titles with a plus sign", () => {
    expect(
      titleYears("2019 Ram 2500 - GRIDIRON - + /3500 Full Tube Front Bumper"),
    ).toEqual([2019, 9999]);
    expect(
      titleYears("GRIDIRON 2017-2022 Ford F250-F550 Base Front Bumper"),
    ).toEqual([2017, 2022]);
  });

  it("matches make, years and model numbers", () => {
    expect(gridironFits('2023-2026 Ford Super Duty 3" Valance', f350)).toBe(
      true,
    );
    expect(
      gridironFits("2017 Ford F250 - GRIDIRON - + -F450 Rear Bumper", f350),
    ).toBe(true);
    expect(
      gridironFits("GRIDIRON 2017-2022 Ford F250-F550 Base Front Bumper", f350),
    ).toBe(false);
    expect(
      gridironFits(
        "2019 Ram 2500 - GRIDIRON - + /3500 Full Tube Front Bumper",
        f350,
      ),
    ).toBe(false);
    expect(
      gridironFits(
        "2018-2024 - GRIDIRON - Ford Expedition Interceptor Front Bumper",
        f350,
      ),
    ).toBe(false);
  });

  it("keeps F-series model numbers in range", () => {
    const f150 = quoteContext({
      vehicle: {
        year: 2020,
        make: "Ford",
        model: "F150",
        engine: null,
        platform: null,
      },
    });
    expect(
      gridironFits("GRIDIRON 2017-2022 Ford F250-F550 Base Front Bumper", f150),
    ).toBe(false);
  });
});

describe("gridironForTruck", () => {
  it("finds no exact listing for a 2023 F350 Full Tube front, and offers what does fit", () => {
    const { exact, fits } = gridironForTruck(
      STORE,
      f350,
      bumperRequest(DANTON),
    );
    expect(exact).toBeNull();
    expect(fits.map((p) => p.title)).toEqual([
      "2017 Ford F250 - GRIDIRON - + -F450 Rear Bumper",
      '2023-2026 Ford Super Duty 3" Valance',
    ]);
  });

  it("puts the exact bumper first when the store has it", () => {
    const ram = quoteContext({
      vehicle: {
        year: 2022,
        make: "Ram",
        model: "3500",
        engine: null,
        platform: "cummins",
      },
    });
    const { exact } = gridironForTruck(STORE, ram, {
      position: "front",
      style: "full tube",
      isWinch: false,
      finish: "custom colour",
      summary: "",
    });
    expect(exact?.title).toBe(
      "2019 Ram 2500 - GRIDIRON - + /3500/4500/5500 Full Tube Front Bumper",
    );
    expect(finishVariant(exact!, "custom colour")).toBe("custom");
  });

  it("never offers merchandise or listings with no truck", () => {
    const titles = gridironForTruck(STORE, f350, null).fits.map((p) => p.title);
    expect(titles).not.toContain("Billet D-Rings");
    expect(titles).not.toContain("GBC Workwear Beanie");
  });
});

describe("Gridiron on a quote", () => {
  it("adds a bumper as a part on its chosen finish, so it is ordered and paid up front", () => {
    const line = lineFromCatalog(STORE[4], "custom");
    expect(line.kind).toBe("part");
    expect(line.variant_id).toBe("custom");
    expect(line.price).toBe(4349);
  });
});
