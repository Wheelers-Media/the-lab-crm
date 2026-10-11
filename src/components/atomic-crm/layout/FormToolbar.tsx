import { CancelButton } from "@/components/admin/cancel-button";
import { SaveButton } from "@/components/admin/form";

export const FormToolbar = () => (
  <div
    role="toolbar"
    className="sticky bottom-0 z-10 -mx-4 flex flex-row justify-end gap-2 border-t border-border bg-background/95 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] backdrop-blur md:mx-0 md:border-0 md:bg-linear-to-b md:from-transparent md:to-card md:to-10% md:px-0 md:pt-4 md:pb-0 md:backdrop-blur-none max-md:[&_[data-slot=button]]:h-12 max-md:[&_[data-slot=button]]:flex-1"
  >
    <CancelButton />
    <SaveButton />
  </div>
);
