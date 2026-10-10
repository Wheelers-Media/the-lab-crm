import { KeyRound } from "lucide-react";
import { useDataProvider, useNotify } from "ra-core";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { CrmDataProvider } from "../providers/types";
import { passwordProblem } from "./passwordRules";

/**
 * Sets a new password for whoever is signed in, right away. No email link,
 * so it works even when reset emails are slow, rate-limited or pre-opened
 * by an email scanner.
 */
export const SetPasswordButton = ({
  className,
  onSave,
  title = "Set your password",
  label = "Set password",
}: {
  className?: string;
  /** Saves the password; defaults to the signed-in user's own. */
  onSave?: (password: string) => Promise<unknown>;
  title?: string;
  label?: string;
}) => {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();

  const close = () => {
    setOpen(false);
    setPassword("");
    setConfirm("");
    setProblem(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const issue = passwordProblem(password, confirm);
    setProblem(issue);
    if (issue) return;
    setSaving(true);
    try {
      await (onSave ?? dataProvider.setOwnPassword)(password);
      notify(
        onSave
          ? "Password saved. Share it in person, not by text or email."
          : "Password saved. Use it next time you sign in.",
      );
      close();
    } catch (error: unknown) {
      setProblem(
        error instanceof Error ? error.message : "Could not save the password.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={className}
        onClick={() => setOpen(true)}
      >
        <KeyRound className="size-4" />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={submit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>
                This changes it right away. No email needed.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirm-password">Type it again</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="h-11"
              />
            </div>
            {problem ? (
              <p role="alert" className="text-sm text-destructive">
                {problem}
              </p>
            ) : null}
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
