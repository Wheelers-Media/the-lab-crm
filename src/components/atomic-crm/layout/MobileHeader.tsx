import { CreateMenu } from "./MobileNavigation";
import { useHeaderAway } from "./useHeaderAway";

/**
 * The phone top bar: back or title on the leading side, page actions, and
 * the + button on the trailing side. Pull down on the page to refresh.
 */
const MobileHeader = ({ children }: { children: React.ReactNode }) => {
  const ref = useHeaderAway<HTMLElement>();
  return (
    <header
      ref={ref}
      className="lab-away lab-glass fixed top-0 left-0 right-0 z-10 flex h-[calc(env(safe-area-inset-top,0px)+3.5rem)] w-full items-center justify-between gap-1 border-b border-border/60 px-2 pl-4 pt-[env(safe-area-inset-top,0px)]"
    >
      {children}
      <CreateMenu />
    </header>
  );
};

export default MobileHeader;
