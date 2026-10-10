import { Plus, Search } from "lucide-react";
import { ListBase, useListContext, useStore } from "ra-core";
import { useMemo, useState } from "react";
import { Link, matchPath, useLocation } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import MobileHeader from "../layout/MobileHeader";
import { MobileContent } from "../layout/MobileContent";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";
import { DealCardContent } from "./DealCard";
import { DealCreate } from "./DealCreate";
import { DealEdit } from "./DealEdit";
import { DealShow } from "./DealShow";
import { columnView, stageTotal } from "./pipelineView";
import { getDealsByStage } from "./stages";

const money = (amount: number) =>
  amount.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
  });

const matchesSearch = (deal: Deal, q: string) =>
  !q || deal.name.toLowerCase().includes(q.toLowerCase());

/** Jobs on the phone: one stage at a time, picked from a row of tabs. */
const MobileDealBoard = () => {
  const { dealStages } = useConfigurationContext();
  const { data, isPending } = useListContext<Deal>();
  const [stage, setStage] = useStore<string>(
    "deals.mobile.stage",
    dealStages[0]?.value ?? "intake",
  );
  const [q, setQ] = useState("");
  const [showOlder, setShowOlder] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const byStage = useMemo(
    () =>
      getDealsByStage(
        (data ?? []).filter((d) => matchesSearch(d, q)),
        dealStages,
      ),
    [data, dealStages, q],
  );
  const current = byStage[stage] ?? [];
  const view = columnView(current, stage, { showOlder, showAll });

  const pick = (value: string) => {
    setStage(value);
    setShowOlder(false);
    setShowAll(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="relative block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search jobs"
          className="pl-9 h-11"
          aria-label="Search jobs"
        />
      </label>
      <div
        role="tablist"
        aria-label="Stage"
        className="-mx-4 px-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]"
      >
        {dealStages.map((s) => {
          const deals = byStage[s.value] ?? [];
          const active = s.value === stage;
          return (
            <button
              key={s.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => pick(s.value)}
              className={`shrink-0 rounded-md border px-3 py-2 text-left min-w-24 ${
                active
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border text-muted-foreground"
              }`}
            >
              <span className="block font-display uppercase tracking-wide text-sm">
                {s.label}{" "}
                <span className="lab-num opacity-70">{deals.length}</span>
              </span>
              <span className="block text-xs lab-num">
                {money(stageTotal(deals))}
              </span>
            </button>
          );
        })}
      </div>
      {isPending ? null : view.visible.length ? (
        <div className="flex flex-col gap-2">
          {view.visible.map((deal) => (
            <DealCardContent key={deal.id} deal={deal} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground py-6 text-center">
          No jobs in this stage{q ? " match your search" : ""}.
        </p>
      )}
      {view.moreCount > 0 ? (
        <Button variant="outline" onClick={() => setShowAll(true)}>
          Show {view.moreCount} more
        </Button>
      ) : null}
      {view.olderCount > 0 ? (
        <Button variant="ghost" onClick={() => setShowOlder(true)}>
          Show {view.olderCount} older
        </Button>
      ) : null}
    </div>
  );
};

const MobileDealRoutes = () => {
  const location = useLocation();
  const matchCreate = matchPath("/deals/create", location.pathname);
  const matchShow = matchPath("/deals/:id/show", location.pathname);
  const matchEdit = matchPath("/deals/:id", location.pathname);
  return (
    <>
      <DealCreate open={!!matchCreate} />
      <DealEdit open={!!matchEdit && !matchCreate} id={matchEdit?.params.id} />
      <DealShow open={!!matchShow} id={matchShow?.params.id} />
    </>
  );
};

export const MobileDealList = () => (
  <ListBase
    resource="deals"
    perPage={1000}
    filter={{ "archived_at@is": null }}
    sort={{ field: "index", order: "DESC" }}
    disableSyncWithLocation
  >
    <MobileHeader>
      <h1 className="text-xl">Jobs</h1>
      <Button asChild size="sm" className="ml-auto mr-2">
        <Link to="/deals/create">
          <Plus className="size-4" />
          New
        </Link>
      </Button>
    </MobileHeader>
    <MobileContent>
      <MobileDealBoard />
    </MobileContent>
    <MobileDealRoutes />
  </ListBase>
);
