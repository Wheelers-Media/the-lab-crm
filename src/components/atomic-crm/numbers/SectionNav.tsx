import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface NumbersSection {
  id: string;
  label: string;
}

/**
 * A row of chips that jumps to each part of the Numbers screen and lights up
 * the part on screen. Numbers is long; without this, finding the stock table
 * on a phone means a dozen flicks.
 */
export const SectionNav = ({ sections }: { sections: NumbersSection[] }) => {
  const [current, setCurrent] = useState(sections[0]?.id);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    // A heading counts as current once it passes the top third of the screen
    const observer = new IntersectionObserver(
      (entries) => {
        const seen = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (seen[0]) setCurrent(seen[0].target.id);
      },
      { rootMargin: "-80px 0px -66% 0px" },
    );
    for (const { id } of sections) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav
      aria-label="Jump to a part of Numbers"
      className="sticky top-0 md:top-14 z-30 -mx-4 bg-background/90 px-4 py-2 backdrop-blur-xl md:mx-0 md:px-0"
    >
      <ul className="lab-scroll-x flex gap-1.5">
        {sections.map(({ id, label }) => (
          <li key={id}>
            <a
              href={`#${id}`}
              onClick={(event) => {
                // The app routes on the hash, so scroll rather than navigate
                event.preventDefault();
                document
                  .getElementById(id)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
                setCurrent(id);
              }}
              aria-current={current === id ? "true" : undefined}
              className={cn(
                "inline-flex h-8 items-center rounded-full px-3 text-[13px] font-medium transition-colors",
                current === id
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
};
