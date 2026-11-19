import { describe, expect, it } from "vitest";

import { mergeWithDefaults } from "./ConfigurationContext";
import { defaultConfiguration } from "./defaultConfiguration";

const ORIGIN = "https://crm.example.com";

describe("mergeWithDefaults", () => {
  it("falls back to the current logo when the saved one is a past deploy's asset", () => {
    // Arrange: a phone saved the hashed URL of an older build
    const saved = {
      darkModeLogo: `${ORIGIN}/assets/the_lab_diamond_white-OLDHASH.png`,
      lightModeLogo: "./logos/logo_atomic_crm_light.svg",
    };

    // Act
    const config = mergeWithDefaults(saved, ORIGIN);

    // Assert
    expect(config.darkModeLogo).toBe(defaultConfiguration.darkModeLogo);
    expect(config.lightModeLogo).toBe(defaultConfiguration.lightModeLogo);
  });

  it("keeps a logo uploaded to storage or given as a data URI", () => {
    const uploaded = "https://abc.supabase.co/storage/v1/object/public/a/l.png";
    const inline = "data:image/png;base64,AAAA";

    const config = mergeWithDefaults(
      { darkModeLogo: uploaded, lightModeLogo: inline },
      ORIGIN,
    );

    expect(config.darkModeLogo).toBe(uploaded);
    expect(config.lightModeLogo).toBe(inline);
  });

  it("keeps the other saved settings", () => {
    const config = mergeWithDefaults(
      { title: "Shop", targets: { revenue: 1000 } },
      ORIGIN,
    );

    expect(config.title).toBe("Shop");
    expect(config.targets).toEqual({ revenue: 1000 });
  });
});
