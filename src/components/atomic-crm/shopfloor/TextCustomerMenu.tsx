import { MessageSquare } from "lucide-react";
import { useNotify } from "ra-core";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";

import { firstPhone } from "../contacts/firstPhone";
import type { Contact, Deal } from "../types";
import { smsHref, templatesFor } from "./messageTemplates";

/**
 * "Text" button for a job: pick a ready-made message and it opens in the
 * phone's Messages app, filled in. On a computer the text is copied instead.
 */
export const TextCustomerMenu = ({
  deal,
  contact,
  vehicle,
  size = "sm",
}: {
  deal: Deal;
  contact?: Contact | null;
  vehicle?: string | null;
  size?: "sm" | "default";
}) => {
  const notify = useNotify();
  const isMobile = useIsMobile();
  const phone = contact ? firstPhone(contact) : null;
  const options = templatesFor(deal, {
    firstName: contact?.first_name,
    vehicle,
    job: deal.name,
  });

  const send = (body: string) => {
    if (!phone) return;
    if (isMobile) {
      window.location.href = smsHref(phone, body);
      return;
    }
    navigator.clipboard
      ?.writeText(body)
      .then(() => notify(`Text copied. Paste it into a message to ${phone}.`))
      .catch(() => notify("Could not copy the text", { type: "error" }));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={size}
          disabled={!phone}
          title={phone ? undefined : "No phone number on file"}
          onClick={(e) => e.stopPropagation()}
        >
          <MessageSquare className="size-4" />
          Text
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {options.map((option) => (
          <DropdownMenuItem
            key={option.id}
            onSelect={() => send(option.body)}
            className="min-h-11"
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
