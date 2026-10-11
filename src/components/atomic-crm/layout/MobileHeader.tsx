import { CreateMenu } from "./MobileNavigation";

/**
 * The phone top bar: back or title on the leading side, page actions, and
 * the + button on the trailing side. Pull down on the page to refresh.
 */
const MobileHeader = ({ children }: { children: React.ReactNode }) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-10 flex h-14 w-full items-center justify-between gap-1 border-b border-border/60 bg-secondary/90 px-2 pl-4 backdrop-blur-xl">
      {children}
      <CreateMenu />
    </header>
  );
};

export default MobileHeader;
