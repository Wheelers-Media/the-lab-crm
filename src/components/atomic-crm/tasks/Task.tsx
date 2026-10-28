import { useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  CalendarDays,
  Check,
  MoreHorizontal,
  MoreVertical,
  Pencil,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  useDeleteWithUndoController,
  useGetRecordRepresentation,
  useNotify,
  useTranslate,
  useUpdate,
} from "ra-core";
import { useEffect, useState } from "react";
import { ReferenceField } from "@/components/admin/reference-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Contact, Task as TData } from "../types";
import { TaskEdit } from "./TaskEdit";
import { TaskEditSheet } from "./TaskEditSheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLongPress } from "@/hooks/use-long-press";
import { ActionSheet } from "../misc/ActionSheet";
import { SwipeRow } from "../misc/SwipeRow";
import { formatDue } from "./taskDue";

export const Task = ({
  task,
  showContact,
}: {
  task: TData;
  showContact?: boolean;
}) => {
  const isMobile = useIsMobile();
  const { taskTypes } = useConfigurationContext();
  const notify = useNotify();
  const translate = useTranslate();
  const queryClient = useQueryClient();
  const getContactRepresentation = useGetRecordRepresentation("contacts");

  const [openEdit, setOpenEdit] = useState(false);

  const handleCloseEdit = () => {
    setOpenEdit(false);
  };

  const [update, { isPending: isUpdatePending, isSuccess, variables }] =
    useUpdate();
  const { handleDelete } = useDeleteWithUndoController({
    record: task,
    redirect: false,
    mutationOptions: {
      onSuccess() {
        notify("resources.tasks.deleted", {
          undoable: true,
        });
      },
    },
  });

  const handleEdit = () => {
    setOpenEdit(true);
  };

  // Show the tick the moment it is tapped and save straight away; the old
  // "undoable" save waited ~5 seconds, so a ticked task looked unticked
  const [isDone, setIsDone] = useState(Boolean(task.done_date));
  useEffect(() => setIsDone(Boolean(task.done_date)), [task.done_date]);
  const toggleDone = () => {
    const next = !isDone;
    setIsDone(next);
    if (next) navigator.vibrate?.(10);
    update(
      "tasks",
      {
        id: task.id,
        data: { done_date: next ? new Date().toISOString() : null },
        previousData: task,
      },
      {
        mutationMode: "pessimistic",
        onError: () => {
          setIsDone(!next);
          notify("Could not update the task. Check your connection.", {
            type: "error",
          });
        },
      },
    );
  };

  useEffect(() => {
    // We do not want to invalidate the query when a tack is checked or unchecked
    if (
      isUpdatePending ||
      !isSuccess ||
      variables?.data?.done_date != undefined
    ) {
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["tasks", "getList"] });
  }, [queryClient, isUpdatePending, isSuccess, variables]);

  const labelId = `checkbox-list-label-${task.id}`;
  const due = formatDue(task.due_date);
  const [sheetOpen, setSheetOpen] = useState(false);
  const longPress = useLongPress(() => setSheetOpen(true));
  const postpone = (days: number) =>
    update("tasks", {
      id: task.id,
      data: {
        due_date: new Date(Date.now() + days * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10),
      },
      previousData: task,
    });

  return (
    <>
      <SwipeRow
        action={
          isMobile
            ? {
                label: isDone ? "Not done" : "Done",
                icon: isDone ? Undo2 : Check,
                tone: "good",
                onTrigger: toggleDone,
              }
            : undefined
        }
      >
        <div
          className="flex items-start justify-between md:py-0 py-1"
          {...(isMobile ? { ...longPress, "data-long-press": "" } : {})}
        >
          <div className="flex items-start gap-3 flex-1">
            <Checkbox
              id={labelId}
              checked={isDone}
              onCheckedChange={toggleDone}
              aria-label={isDone ? "Mark not done" : "Mark done"}
              className="relative mt-0.5 size-6 rounded-full transition-colors after:absolute after:-inset-2.5 after:content-[''] md:size-4 md:rounded-sm"
            />
            {/* The whole text is part of the tap target on a phone: one tap, one toggle */}
            <label
              htmlFor={isMobile ? labelId : undefined}
              className={`flex-grow transition-opacity ${isDone ? "line-through opacity-60" : ""}`}
            >
              <div className="text-base md:text-sm">
                {task.type && task.type !== "none" && (
                  <>
                    <span className="font-semibold text-sm">
                      {(() => {
                        const matchedTaskType = taskTypes.find(
                          (taskType) => taskType.value === task.type,
                        );
                        return matchedTaskType
                          ? matchedTaskType.label
                          : task.type;
                      })()}
                    </span>
                    &nbsp;
                  </>
                )}
                {task.text}
              </div>
              <div className="text-sm text-muted-foreground">
                <span
                  className={
                    due.isOverdue && !isDone ? "text-destructive" : undefined
                  }
                >
                  {due.label}
                </span>
                {showContact && (
                  <ReferenceField<TData, Contact>
                    source="contact_id"
                    reference="contacts"
                    record={task}
                    link="show"
                    className="lab-tap-links inline text-sm text-muted-foreground"
                    render={({ referenceRecord }) => {
                      if (!referenceRecord) return null;
                      return (
                        <>
                          {" "}
                          {translate("resources.tasks.regarding_contact", {
                            name: getContactRepresentation(referenceRecord),
                          })}
                        </>
                      );
                    }}
                  />
                )}
              </div>
            </label>
          </div>

          {isMobile ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-10 -mr-2 -mt-1.5 text-muted-foreground"
              aria-label={translate("resources.tasks.actions.title")}
              onClick={() => setSheetOpen(true)}
            >
              <MoreHorizontal className="size-5" />
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 pr-0! size-8 cursor-pointer"
                  aria-label={translate("resources.tasks.actions.title")}
                >
                  <MoreVertical className="size-5 md:size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="cursor-pointer h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
                  onClick={() => {
                    update("tasks", {
                      id: task.id,
                      data: {
                        due_date: new Date(Date.now() + 24 * 60 * 60 * 1000)
                          .toISOString()
                          .slice(0, 10),
                      },
                      previousData: task,
                    });
                  }}
                >
                  {translate("resources.tasks.actions.postpone_tomorrow")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
                  onClick={() => {
                    update("tasks", {
                      id: task.id,
                      data: {
                        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                          .toISOString()
                          .slice(0, 10),
                      },
                      previousData: task,
                    });
                  }}
                >
                  {translate("resources.tasks.actions.postpone_next_week")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
                  onClick={handleEdit}
                >
                  {translate("ra.action.edit")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer h-12 md:h-8 px-4 md:px-2 text-base md:text-sm"
                  onClick={handleDelete}
                >
                  {translate("ra.action.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </SwipeRow>

      {isMobile ? (
        <ActionSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          title={task.text}
          subtitle={due.label}
          actions={[
            {
              label: isDone ? "Mark not done" : "Mark done",
              icon: isDone ? Undo2 : Check,
              onSelect: toggleDone,
            },
            {
              label: translate("resources.tasks.actions.postpone_tomorrow"),
              icon: CalendarClock,
              onSelect: () => postpone(1),
            },
            {
              label: translate("resources.tasks.actions.postpone_next_week"),
              icon: CalendarDays,
              onSelect: () => postpone(7),
            },
            {
              label: translate("ra.action.edit"),
              icon: Pencil,
              onSelect: handleEdit,
            },
            {
              label: translate("ra.action.delete"),
              icon: Trash2,
              destructive: true,
              onSelect: (event) => handleDelete(event),
            },
          ]}
        />
      ) : null}

      {isMobile ? (
        <TaskEditSheet
          taskId={task.id}
          open={openEdit}
          onOpenChange={setOpenEdit}
        />
      ) : (
        <TaskEdit taskId={task.id} open={openEdit} close={handleCloseEdit} />
      )}
    </>
  );
};
