import { useGetList } from "ra-core";

import type { Contact } from "../types";
import { DashboardActivityLog } from "./DashboardActivityLog";
import { DashboardStepper } from "./DashboardStepper";
import { HotContacts } from "./HotContacts";
import { TasksList } from "./TasksList";
import { Welcome } from "./Welcome";
import { CommandCenter } from "../operations/CommandCenter";

export const Dashboard = () => {
  const { total: totalContact, isPending: isPendingContact } =
    useGetList<Contact>("contacts", {
      pagination: { page: 1, perPage: 1 },
    });

  const isPending = isPendingContact;

  if (isPending) {
    return null;
  }

  if (!totalContact) {
    return <DashboardStepper step={1} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <CommandCenter />
      {/* One primary column and one quieter one, rather than four cards of
          equal weight competing with the hero above */}
      {/* Same column widths and gutter as the rail grid in CommandCenter, so
          the edges line up from the top of the page to the bottom */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 xl:grid-cols-[minmax(0,1fr)_24rem] 2xl:grid-cols-[minmax(0,1fr)_28rem]">
        <div className="lg:col-span-2 xl:col-span-1 min-w-0 flex flex-col gap-6">
          <DashboardActivityLog />
        </div>
        <div className="min-w-0 flex flex-col gap-6">
          {import.meta.env.VITE_IS_DEMO === "true" ? <Welcome /> : null}
          <HotContacts />
          <div id="tasks">
            <TasksList />
          </div>
        </div>
      </div>
    </div>
  );
};
