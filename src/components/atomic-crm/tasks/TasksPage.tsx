import { useTranslate } from "ra-core";
import { Card } from "@/components/ui/card";

import { AddTask } from "./AddTask";
import { TasksListContent } from "./TasksListContent";

/**
 * Every open task on a desktop: overdue first, then today, tomorrow and
 * later. The phone has had this list all along; without it, Home's
 * "overdue tasks" link opened an empty page on a desktop.
 */
export const TasksPage = () => {
  const translate = useTranslate();
  return (
    <div className="mx-auto mt-2 flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-display uppercase tracking-wide">
          {translate("resources.tasks.name", { smart_count: 2 })}
        </h1>
        <AddTask display="icon" selectContact />
      </div>
      <Card className="p-4">
        <TasksListContent />
      </Card>
    </div>
  );
};
