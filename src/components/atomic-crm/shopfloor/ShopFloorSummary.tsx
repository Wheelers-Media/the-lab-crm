import { Wrench } from "lucide-react";
import { Link } from "react-router";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { SectionTitle } from "../operations/OperationsWidgets";
import type { Deal } from "../types";
import { floorCounts } from "./workStatus";

/** Dashboard card: how many vehicles are in each place, one tap to the board. */
export const ShopFloorSummary = ({
  deals,
  now,
}: {
  deals: Deal[];
  now: Date;
}) => {
  const counts = floorCounts(deals, now);
  const tiles = [
    { label: "In the shop", value: counts.inShop },
    { label: "Waiting on parts", value: counts.waitingParts },
    { label: "Ready for pickup", value: counts.ready },
  ];
  return (
    <Card className="p-4 gap-0">
      <SectionTitle
        icon={Wrench}
        action={
          <Link
            to="/shop-floor"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Open
          </Link>
        }
      >
        Shop floor
      </SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        {tiles.map((tile) => (
          <Link
            key={tile.label}
            to="/shop-floor"
            className="rounded-md p-2 hover:bg-muted flex flex-col"
          >
            <span className="text-2xl font-semibold lab-num">{tile.value}</span>
            <span className="text-xs text-muted-foreground">{tile.label}</span>
          </Link>
        ))}
      </div>
      {counts.chase ? (
        <p className={cn("text-xs mt-2 lab-chip lab-chip-warn w-fit")}>
          {counts.chase} waiting longer than they should
        </p>
      ) : null}
    </Card>
  );
};
