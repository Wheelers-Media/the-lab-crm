import { describe, expect, it } from "vitest";

import type { Package } from "../types";
import {
  chooseOption,
  includedSteps,
  missingRequired,
  powerPackageFor,
  POWER_PACKAGES,
  removeOption,
  resolvePowerSteps,
  type PowerPackage,
} from "./powerPackageModel";

const product = (handle: string, id: number, price = 100): Package =>
  ({
    id,
    handle,
    title: handle,
    kind: "product",
    status: "active",
    category: handle.includes("tuning") ? "tuning" : null,
    price,
    variants: [{ id: `v${id}`, title: "Default Title", price }],
  }) as unknown as Package;

/** A catalog holding every product the package's steps name. */
const catalogFor = (pkg: PowerPackage, skip: string[] = []) => {
  let id = 1;
  return pkg.steps
    .flatMap((s) => s.options)
    .filter((o) => !skip.includes(o.handle))
    .map((o) => product(o.handle, id++));
};

const ps2023 = POWER_PACKAGES.find((p) => p.id === "powerstroke-2023-2026")!;
const l5p2020 = POWER_PACKAGES.find((p) => p.id === "l5p-2020-2023")!;

describe("powerPackageFor", () => {
  it("finds the package for the truck's platform and year", () => {
    expect(
      powerPackageFor({ platform: "powerstroke", year: 2024, engine: "6.7" })
        ?.id,
    ).toBe("powerstroke-2023-2026");
    expect(
      powerPackageFor({ platform: "cummins", year: 2019, engine: null })?.id,
    ).toBe("cummins-2019-2021");
    expect(
      powerPackageFor({ platform: "duramax", year: 2018, engine: "6.6" })?.id,
    ).toBe("l5p-2017-2019");
  });

  it("returns nothing for a truck the website does not build for", () => {
    // 6.4L Powerstroke, 2010 Super Duty, and a year with no package
    expect(
      powerPackageFor({ platform: "powerstroke", year: 2008, engine: "6.4" }),
    ).toBeNull();
    expect(
      powerPackageFor({ platform: "powerstroke", year: 2010, engine: null }),
    ).toBeNull();
    expect(
      powerPackageFor({ platform: "ecodiesel", year: 2020, engine: "3.0" }),
    ).toBeNull();
    expect(
      powerPackageFor({ platform: "powerstroke", year: null, engine: null }),
    ).toBeNull();
  });
});

describe("resolvePowerSteps", () => {
  it("matches every option to the catalog by handle", () => {
    const { steps, missing } = resolvePowerSteps(ps2023, catalogFor(ps2023));
    expect(missing).toEqual([]);
    expect(steps.map((s) => s.step.id)).toEqual(ps2023.steps.map((s) => s.id));
  });

  it("drops an option the catalog does not sell and reports it", () => {
    const gone = ps2023.steps[1].options[0].handle; // the tuning device
    const { steps, missing } = resolvePowerSteps(
      ps2023,
      catalogFor(ps2023, [gone]),
    );
    expect(missing).toEqual([gone]);
    expect(steps.some((s) => s.step.id === "device")).toBe(false);
  });

  it("ignores draft and archived products", () => {
    const catalog = catalogFor(ps2023).map((p) => ({
      ...p,
      status: "draft" as const,
    }));
    expect(resolvePowerSteps(ps2023, catalog).steps).toEqual([]);
  });
});

describe("chooseOption", () => {
  const catalog = catalogFor(ps2023);
  const { steps } = resolvePowerSteps(ps2023, catalog);
  const optionOf = (stepId: string, at = 0) =>
    steps.find((s) => s.step.id === stepId)!.options[at].product;

  it("adds a line tagged with its build and step", () => {
    const lines = chooseOption(
      [],
      ps2023.id,
      steps,
      "exhaust",
      optionOf("exhaust"),
      undefined,
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ build: ps2023.id, step: "exhaust" });
  });

  it("swaps the choice in a pick-one step", () => {
    let lines = chooseOption(
      [],
      ps2023.id,
      steps,
      "exhaust",
      optionOf("exhaust", 0),
      undefined,
    );
    lines = chooseOption(
      lines,
      ps2023.id,
      steps,
      "exhaust",
      optionOf("exhaust", 1),
      undefined,
    );
    expect(lines.filter((l) => l.step === "exhaust")).toHaveLength(1);
    expect(lines[0].package_id).toBe(optionOf("exhaust", 1).id);
  });

  it("keeps several choices in a pick-many step and removes one on request", () => {
    let lines = chooseOption(
      [],
      ps2023.id,
      steps,
      "egr",
      optionOf("egr", 0),
      undefined,
    );
    lines = chooseOption(
      lines,
      ps2023.id,
      steps,
      "egr",
      optionOf("egr", 1),
      undefined,
    );
    expect(lines.filter((l) => l.step === "egr")).toHaveLength(2);
    lines = removeOption(lines, ps2023.id, "egr", optionOf("egr", 0).id);
    expect(lines.map((l) => l.package_id)).toEqual([optionOf("egr", 1).id]);
  });

  it("does not touch lines outside the build", () => {
    const labour = {
      package_id: null,
      title: "Labour",
      price: 125,
      quantity: 2,
      kind: "labour" as const,
    };
    const lines = chooseOption(
      [labour],
      ps2023.id,
      steps,
      "exhaust",
      optionOf("exhaust"),
      undefined,
    );
    expect(lines).toContain(labour);
  });
});

describe("included steps and required steps", () => {
  it("a package that includes the downpipe replaces a separate downpipe choice", () => {
    const catalog = catalogFor(l5p2020);
    const { steps } = resolvePowerSteps(l5p2020, catalog);
    const exhaust = steps.find((s) => s.step.id === "exhaust")!;
    const withDownpipe = exhaust.options.find((o) =>
      o.option.includes?.includes("downpipe"),
    );
    const downpipe = steps.find((s) => s.step.id === "downpipe");
    if (!withDownpipe || !downpipe) return; // this platform has no such package
    let lines = chooseOption(
      [],
      l5p2020.id,
      steps,
      "downpipe",
      downpipe.options[0].product,
      undefined,
    );
    lines = chooseOption(
      lines,
      l5p2020.id,
      steps,
      "exhaust",
      withDownpipe.product,
      undefined,
    );
    expect(lines.some((l) => l.step === "downpipe")).toBe(false);
    expect(includedSteps(lines, steps, l5p2020.id).has("downpipe")).toBe(true);
  });

  it("lists required steps that have nothing chosen", () => {
    const { steps } = resolvePowerSteps(ps2023, catalogFor(ps2023));
    expect(missingRequired([], steps, ps2023.id)).toEqual([
      "Tuning",
      "Exhaust",
    ]);
    const lines = chooseOption(
      [],
      ps2023.id,
      steps,
      "tune",
      steps.find((s) => s.step.id === "tune")!.options[0].product,
      undefined,
    );
    expect(missingRequired(lines, steps, ps2023.id)).toEqual(["Exhaust"]);
  });
});

describe("preselected parts", () => {
  it("adds the parts the tune needs when the build starts", () => {
    const pkg = POWER_PACKAGES.find((p) =>
      p.steps.some((s) => s.options.some((o) => o.preselect)),
    )!;
    const { steps } = resolvePowerSteps(pkg, catalogFor(pkg));
    const pre = steps
      .flatMap((s) => s.options.map((o) => ({ s, o })))
      .find(({ o }) => o.option.preselect)!;
    const tune = steps.find((s) => s.step.id === "tune")!.options[0].product;
    const lines = chooseOption([], pkg.id, steps, "tune", tune, undefined);
    expect(lines.map((l) => l.package_id)).toContain(pre.o.product.id);
    // a second choice does not add them again
    const again = chooseOption(
      lines,
      pkg.id,
      steps,
      "exhaust",
      steps.find((s) => s.step.id === "exhaust")!.options[0].product,
      undefined,
    );
    expect(again.filter((l) => l.package_id === pre.o.product.id)).toHaveLength(
      1,
    );
  });
});
