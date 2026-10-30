import { TasksListByDueDate } from "./TasksListByDueDate";
import { useTranslate } from "ra-core";

export const TasksListContent = ({ columns }: { columns?: boolean }) => {
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-4">
      <TasksListByDueDate
        columns={columns}
        emptyPlaceholder={
          <p className="text-sm">
            {translate("resources.tasks.empty_list_hint")}
          </p>
        }
      />
    </div>
  );
};
