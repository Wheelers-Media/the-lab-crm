import { useMutation } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useDataProvider, useNotify, useRefresh } from "ra-core";
import { Button } from "@/components/ui/button";

import type { CrmDataProvider } from "../providers/types";

/** Copies the whole Shopify catalog (descriptions, pictures, tags, cost) into the CRM. */
export const SyncCatalogButton = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const refresh = useRefresh();
  const { mutate, isPending } = useMutation({
    mutationFn: () => dataProvider.syncCatalog(),
    onSuccess: (result) => {
      notify(
        `Synced ${result.synced} products from Shopify. ${
          result.costAvailable
            ? `Cost is known for ${result.withCost}.`
            : "Cost needs the read_inventory permission in the Shopify app."
        }`,
      );
      refresh();
    },
    onError: (error: Error) => notify(error.message, { type: "error" }),
  });
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => mutate()}
    >
      <RefreshCw className={isPending ? "size-4 animate-spin" : "size-4"} />
      Sync from Shopify
    </Button>
  );
};
