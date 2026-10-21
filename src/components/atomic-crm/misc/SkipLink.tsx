/** The first thing a keyboard or switch user reaches: jump past the nav. */
export const SkipLink = () => (
  <a
    href="#main-content"
    className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-md focus:border focus:border-border focus:bg-background focus:px-4 focus:text-sm focus:font-medium focus:text-foreground"
  >
    Skip to content
  </a>
);
