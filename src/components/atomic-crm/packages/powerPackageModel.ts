// The website's diesel power packages, as the quote builder uses them. The
// steps, options and Shopify handles come from thelabfsj.ca (synced by
// scripts/sync-power-packages.mjs), so a quote offers exactly what the website
// does. Prices, photos and variants come from the CRM's Shopify catalog.
import type { DealPackageLine, Package } from "../types";
import { POWER_PACKAGE_FILES } from "./powerPackages";
import { lineFromCatalog, type QuoteContext } from "./quoteModel";

export interface PowerOption {
  handle: string;
  brand?: string;
  name: string;
  note?: string;
  /** The tuning platform this option runs on (EZ LYNK, HP Tuners). */
  runner?: string;
  /** Step ids this option already covers (an exhaust package includes the downpipe). */
  includes?: string[];
  /** Added for the customer when the build starts: parts the tune needs. */
  preselect?: boolean;
}

export interface PowerStep {
  id: string;
  title: string;
  required: boolean;
  /** "one": pick a single option. "many": any number. */
  mode: "one" | "many";
  text?: string;
  options: PowerOption[];
}

export interface PowerPackage {
  id: string;
  title: string;
  make: string;
  engine: string;
  years: string;
  steps: PowerStep[];
}

export const POWER_PACKAGES = POWER_PACKAGE_FILES as unknown as PowerPackage[];

// The id prefix each platform's packages use, and the engine they are built for
const FAMILY: Record<string, { prefix: string; engine: string }> = {
  powerstroke: { prefix: "powerstroke-", engine: "6.7" },
  cummins: { prefix: "cummins-", engine: "6.7" },
  duramax: { prefix: "l5p-", engine: "6.6" },
};

const yearsOf = (pkg: PowerPackage): [number, number] => {
  const [from, to] = pkg.years.split("-").map(Number);
  return [from, to ?? from];
};

/**
 * The power package for a truck: same platform, a model year inside the
 * package's years, and the engine the package is built for. Null when the
 * truck is not one the website builds for (so the builder stays out of the way).
 */
export const powerPackageFor = (
  ctx: Pick<QuoteContext, "platform" | "year" | "engine">,
): PowerPackage | null => {
  const family = ctx.platform ? FAMILY[ctx.platform] : undefined;
  if (!family || ctx.year == null) return null;
  if (ctx.engine && ctx.engine !== family.engine) return null;
  return (
    POWER_PACKAGES.find((pkg) => {
      const [from, to] = yearsOf(pkg);
      return (
        pkg.id.startsWith(family.prefix) && ctx.year! >= from && ctx.year! <= to
      );
    }) ?? null
  );
};

export interface ResolvedOption {
  option: PowerOption;
  product: Package;
}
export interface ResolvedStep {
  step: PowerStep;
  options: ResolvedOption[];
}

/**
 * The package's steps with each option matched to the CRM's catalog by Shopify
 * handle. An option the catalog does not have for sale is dropped, the same as
 * the website drops a product Shopify no longer lists, and reported in
 * `missing` so a gap is visible rather than silent.
 */
export const resolvePowerSteps = (
  pkg: PowerPackage,
  catalog: Package[],
): { steps: ResolvedStep[]; missing: string[] } => {
  const byHandle = new Map(
    catalog
      .filter(
        (p) =>
          p.kind === "product" &&
          p.handle &&
          (p.status === "active" || p.status === "unlisted"),
      )
      .map((p) => [p.handle as string, p]),
  );
  const missing: string[] = [];
  const steps: ResolvedStep[] = [];
  for (const step of pkg.steps) {
    const options: ResolvedOption[] = [];
    for (const option of step.options) {
      const product = byHandle.get(option.handle);
      if (product) options.push({ option, product });
      else missing.push(option.handle);
    }
    if (options.length) steps.push({ step, options });
  }
  return { steps, missing };
};

const inBuild = (line: DealPackageLine, build: string) => line.build === build;

/** The lines of this build, per step id. */
export const picksByStep = (
  lines: DealPackageLine[],
  build: string,
): Map<string, DealPackageLine[]> => {
  const out = new Map<string, DealPackageLine[]>();
  for (const line of lines) {
    if (!inBuild(line, build) || !line.step) continue;
    out.set(line.step, [...(out.get(line.step) ?? []), line]);
  }
  return out;
};

/** Step ids already covered by a chosen option (a downpipe inside an exhaust package). */
export const includedSteps = (
  lines: DealPackageLine[],
  resolved: ResolvedStep[],
  build: string,
): Set<string> => {
  const picks = picksByStep(lines, build);
  const covered = new Set<string>();
  for (const { step, options } of resolved) {
    for (const line of picks.get(step.id) ?? []) {
      const chosen = options.find(
        (o) => String(o.product.id) === String(line.package_id),
      );
      chosen?.option.includes?.forEach((id) => covered.add(id));
    }
  }
  return covered;
};

/** Required steps with nothing chosen yet, by title. */
export const missingRequired = (
  lines: DealPackageLine[],
  resolved: ResolvedStep[],
  build: string,
): string[] => {
  const picks = picksByStep(lines, build);
  const covered = includedSteps(lines, resolved, build);
  return resolved
    .filter(
      ({ step }) =>
        step.required && !picks.has(step.id) && !covered.has(step.id),
    )
    .map(({ step }) => step.title);
};

const firstInStock = (product: Package): string | undefined =>
  (
    product.variants.find((v) => v.inventory == null || v.inventory > 0) ??
    product.variants[0]
  )?.id;

const tag = (
  line: DealPackageLine,
  build: string,
  step: string,
): DealPackageLine => ({ ...line, build, step });

/**
 * Choose an option: a "one" step swaps its previous choice, a package that
 * includes other steps removes their separate choices, and the first choice in
 * a build also adds the parts the tune needs (`preselect`), as the website does.
 */
export const chooseOption = (
  lines: DealPackageLine[],
  build: string,
  resolved: ResolvedStep[],
  stepId: string,
  product: Package,
  variantId: string | undefined,
  vin?: string | null,
): DealPackageLine[] => {
  const target = resolved.find((r) => r.step.id === stepId);
  const chosen = target?.options.find((o) => o.product.id === product.id);
  if (!target || !chosen) return lines;
  const starting = !lines.some((l) => inBuild(l, build));
  const drop = new Set(chosen.option.includes ?? []);
  if (target.step.mode === "one") drop.add(stepId);
  const kept = lines.filter(
    (l) =>
      !(
        inBuild(l, build) &&
        l.step &&
        (l.step === stepId
          ? target.step.mode === "one" ||
            String(l.package_id) === String(product.id)
          : drop.has(l.step))
      ),
  );
  const added = [tag(lineFromCatalog(product, variantId, vin), build, stepId)];
  if (starting) {
    for (const r of resolved) {
      for (const o of r.options) {
        if (!o.option.preselect || o.product.id === product.id) continue;
        if (drop.has(r.step.id)) continue;
        added.push(
          tag(
            lineFromCatalog(o.product, firstInStock(o.product), vin),
            build,
            r.step.id,
          ),
        );
      }
    }
  }
  return [...kept, ...added];
};

/** Take an option back out of the quote. */
export const removeOption = (
  lines: DealPackageLine[],
  build: string,
  stepId: string,
  productId: Package["id"],
): DealPackageLine[] =>
  lines.filter(
    (l) =>
      !(
        inBuild(l, build) &&
        l.step === stepId &&
        String(l.package_id) === String(productId)
      ),
  );

/** "Exhaust" for a line built from the exhaust step of a package, for labelling a quote line. */
export const stepTitle = (
  build: string | undefined,
  step: string | undefined,
): string | null =>
  (build && step
    ? POWER_PACKAGES.find((p) => p.id === build)?.steps.find(
        (s) => s.id === step,
      )?.title
    : null) ?? null;
