import type { Package } from "../types";
import { chooseVariant, optionValues, variantChoices } from "./quoteModel";

const selectClass =
  "h-10 w-full min-w-0 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30";

/**
 * Picks a product's option the way the website does: one dropdown per option
 * (Tune-Level, VIN license...) when Shopify names them, else one list of
 * variants. Shows the price of the chosen variant.
 */
export const VariantPicker = ({
  pkg,
  value,
  onChange,
}: {
  pkg: Pick<Package, "title" | "variants">;
  value: string;
  onChange: (variantId: string) => void;
}) => {
  const { variants } = pkg;
  const current = variants.find((v) => v.id === value) ?? variants[0];
  const choices = variantChoices(variants);
  if (variants.length < 2 || !current) return null;
  if (!choices) {
    return (
      <select
        value={current.id}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`Option for ${pkg.title}`}
        className={selectClass}
      >
        {variants.map((v) => (
          <option key={v.id} value={v.id}>
            {v.title} - ${v.price}
          </option>
        ))}
      </select>
    );
  }
  const picked = choices[variants.indexOf(current)];
  return (
    <div className="flex flex-col gap-2">
      {picked.map((_, position) => (
        <select
          key={position}
          value={picked[position]}
          onChange={(e) =>
            onChange(
              chooseVariant(variants, current.id, position, e.target.value),
            )
          }
          aria-label={`Option ${position + 1} for ${pkg.title}`}
          className={selectClass}
        >
          {optionValues(variants, current.id, position).map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      ))}
      <p className="text-sm lab-num">${current.price}</p>
    </div>
  );
};
