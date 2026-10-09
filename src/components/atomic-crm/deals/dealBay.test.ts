import { describe, expect, it } from "vitest";

import { bayClassName, dealBay } from "./dealBay";

describe("dealBay", () => {
  it("puts tuning and diesel parts in the Parts Store bay", () => {
    expect(dealBay("tuning")).toBe("parts");
    expect(dealBay("diesel-parts")).toBe("parts");
  });

  it("puts tint, detailing, lighting and installs in the Boutique bay", () => {
    expect(dealBay("window-tint")).toBe("boutique");
    expect(dealBay("sxs-tint")).toBe("boutique");
    expect(dealBay("detailing")).toBe("boutique");
    expect(dealBay("gridiron")).toBe("boutique");
  });

  it("leaves jobs with no or unknown category without a bay bar", () => {
    expect(dealBay(null)).toBeNull();
    expect(dealBay("other")).toBeNull();
    expect(bayClassName(undefined)).toBe("");
  });

  it("gives the matching top-bar class", () => {
    expect(bayClassName("tuning")).toBe("lab-bay-parts");
    expect(bayClassName("detailing")).toBe("lab-bay-boutique");
  });
});
