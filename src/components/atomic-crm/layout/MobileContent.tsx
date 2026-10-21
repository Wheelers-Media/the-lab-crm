import { type ReactNode } from "react";

export const MobileContent = ({ children }: { children: ReactNode }) => (
  <main
    className="lab-page-in max-w-screen-xl mx-auto pt-[calc(env(safe-area-inset-top,0px)+4.5rem)] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+6rem)] min-h-screen overflow-y-auto"
    id="main-content"
    tabIndex={-1}
  >
    {children}
  </main>
);
