import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

import { useInView } from "./useInView";

/**
 * Fades and lifts its contents in the first time they scroll into view, so a
 * long screen of cards arrives one block at a time instead of all at once.
 * No motion for anyone who has asked their system for less.
 */
export const Reveal = ({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  /** Milliseconds to wait, to stagger blocks that arrive together. */
  delay?: number;
}) => {
  const [ref, inView] = useInView<HTMLDivElement>(0.01);
  return (
    <div
      ref={ref}
      className={cn("lab-reveal", inView && "is-in", className)}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
};
