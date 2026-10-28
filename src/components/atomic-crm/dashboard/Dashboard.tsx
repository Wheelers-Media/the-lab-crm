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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 min-w-0 flex flex-col gap-6">
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
