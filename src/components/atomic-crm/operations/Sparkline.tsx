import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * A small trend line for a number tile: the last few periods, oldest on the
 * left. The final point is the period in progress, so it is drawn hollow and
 * reached by a dashed step: it is a count so far, not a finished result.
 */
export const Sparkline = ({
  values,
  className,
  label,
}: {
  values: Array<number | null>;
  className?: string;
  /** Read out to screen readers in place of the picture. */
  label: string;
}) => {
  const gradientId = useId();
  const points = values.map((v) => v ?? 0);
  if (points.length < 2) return null;

  const top = Math.max(...points);
  const bottom = Math.min(0, ...points);
  const span = top - bottom || 1;
  const width = 100;
  const height = 32;
  const pad = 3;
  const x = (i: number) => (i / (points.length - 1)) * width;
  const y = (v: number) => pad + (1 - (v - bottom) / span) * (height - pad * 2);

  const settled = points.slice(0, -1);
  const line = settled
    .map(
      (v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(v).toFixed(2)}`,
    )
    .join(" ");
  const area = `${line} L${x(settled.length - 1)},${height} L0,${height} Z`;
  const lastIndex = points.length - 1;
  const prior = points[lastIndex - 1];
  const last = points[lastIndex];

  return (
    <div
      role="img"
      aria-label={label}
      className={cn("relative h-8 w-full", className)}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        className="absolute inset-0 h-full w-full overflow-visible"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--lab-blue)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--lab-blue)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradientId})`} />
        <path
          d={line}
          fill="none"
          stroke="var(--lab-blue-text)"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={`M${x(lastIndex - 1)},${y(prior)} L${x(lastIndex)},${y(last)}`}
          fill="none"
          stroke="var(--lab-blue-text)"
          strokeWidth="1.5"
          strokeDasharray="2 3"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {/* The dot is HTML so the stretched SVG does not squash it */}
      <span
        aria-hidden="true"
        className="absolute size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-[var(--lab-blue-text)] bg-card"
        style={{ left: "100%", top: `${(y(last) / height) * 100}%` }}
      />
    </div>
  );
};
