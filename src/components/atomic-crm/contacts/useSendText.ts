import { useNotify } from "ra-core";
import { useIsMobile } from "@/hooks/use-mobile";

import { smsHref } from "../shopfloor/messageTemplates";
import { dial, go } from "./reach";

/**
 * Opens Messages with the text filled in on a phone. On a computer, where
 * there is no Messages app to open, the text is copied instead.
 */
export const useSendText = () => {
  const notify = useNotify();
  const isMobile = useIsMobile();
  return (phone: string, body: string): void => {
    if (isMobile) {
      go(smsHref(dial(phone), body));
      return;
    }
    if (!navigator.clipboard) {
      notify("Could not copy the text", { type: "error" });
      return;
    }
    navigator.clipboard
      .writeText(body)
      .then(() => notify(`Text copied. Paste it into a message to ${phone}.`))
      .catch(() => notify("Could not copy the text", { type: "error" }));
  };
};
