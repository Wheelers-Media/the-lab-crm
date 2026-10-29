import { Copy, Pencil, Trash2 } from "lucide-react";
import { useDelete, useNotify } from "ra-core";

import type { SheetAction } from "../misc/ActionSheet";
import type { SwipeAction } from "../misc/SwipeRow";
import type { ContactNote, DealNote } from "../types";

/**
 * Edit, copy and delete for a note row. Delete shows an Undo for a few
 * seconds before the note is really gone.
 */
export const useNoteActions = ({
  note,
  resource,
  onEdit,
}: {
  note: ContactNote | DealNote;
  resource: string;
  onEdit: () => void;
}): { actions: SheetAction[]; swipeLeft: SwipeAction } => {
  const notify = useNotify();
  const [deleteNote] = useDelete();

  const remove = () =>
    deleteNote(
      resource,
      { id: note.id, previousData: note },
      {
        mutationMode: "undoable",
        onSuccess: () =>
          notify("resources.notes.deleted", {
            type: "info",
            undoable: true,
            messageArgs: { _: "Note deleted" },
          }),
        onError: () =>
          notify("Could not delete the note. Try again.", { type: "error" }),
      },
    );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(note.text ?? "");
      notify("Note copied", { type: "info" });
    } catch {
      notify("Could not copy. Select the text instead.", { type: "warning" });
    }
  };

  return {
    actions: [
      { label: "Edit note", icon: Pencil, onSelect: onEdit },
      {
        label: "Copy text",
        icon: Copy,
        hidden: !note.text?.trim(),
        onSelect: () => void copy(),
      },
      {
        label: "Delete note",
        icon: Trash2,
        destructive: true,
        onSelect: remove,
      },
    ],
    swipeLeft: {
      label: "Delete",
      icon: Trash2,
      tone: "danger",
      onTrigger: remove,
    },
  };
};
