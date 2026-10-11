import { useResourceContext, useCreatePath } from "ra-core";
import { useNavigate } from "react-router";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const MobileBackButton = (props: { resource?: string; to?: string }) => {
  const resource = useResourceContext(props);
  const navigate = useNavigate();
  const createPath = useCreatePath();
  const { to } = props;
  const finalTo =
    to ??
    createPath({
      resource,
      type: "list",
    });

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="-ml-3 size-11 rounded-full"
      onClick={(e) => {
        e.preventDefault();
        // Go back like iOS does, so the list returns to where you were;
        // opened from a link with no history, go to the list instead
        const idx = (window.history.state as { idx?: number } | null)?.idx;
        if (idx && idx > 0) navigate(-1);
        else navigate(finalTo);
      }}
    >
      <ChevronLeft className="size-7" />
      <span className="sr-only">Back{to ? "" : " to list"}</span>
    </Button>
  );
};
