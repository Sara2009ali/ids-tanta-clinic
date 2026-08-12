"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, KeyRound, Loader2, ShieldOff } from "lucide-react";
import { enableDoctorAccess, revokeDoctorAccess } from "@/lib/doctors/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * "Enable access" doubles as "reset password" once access is already on —
 * enableDoctorAccess() always un-bans + issues a fresh password, so this
 * is the one action that covers both "grant access for the first time" and
 * "they forgot their password." No separate reset-password action needed.
 */
export function DoctorAccountPanel({
  doctorId,
  email,
  hasAccess,
}: {
  doctorId: string;
  email: string | null;
  hasAccess: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);

  function handleEnable() {
    startTransition(async () => {
      const result = await enableDoctorAccess(doctorId);
      if (result.error) {
        toast.error(result.error);
      } else {
        setTemporaryPassword(result.temporaryPassword ?? null);
        router.refresh();
      }
    });
  }

  function handleRevoke() {
    startTransition(async () => {
      const result = await revokeDoctorAccess(doctorId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Access revoked");
        router.refresh();
      }
    });
  }

  function handleCopyPassword() {
    if (!temporaryPassword) return;
    navigator.clipboard.writeText(temporaryPassword).then(
      () => toast.success("Password copied"),
      () => toast.error("Couldn't copy — select and copy it manually."),
    );
  }

  return (
    <>
      <div className="space-y-3 rounded-xl border border-border p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">Application access</p>
            <p className="text-xs text-muted-foreground">{email ?? "No login email on file"}</p>
          </div>
          <Badge variant={hasAccess ? "secondary" : "outline"}>{hasAccess ? "Active access" : "No access"}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasAccess ? (
            <>
              <Button variant="outline" size="sm" disabled={pending} onClick={handleEnable}>
                {pending ? <Loader2 className="size-3.5 animate-spin" /> : <KeyRound className="size-3.5" />}
                Reset password
              </Button>
              <Button variant="outline" size="sm" disabled={pending} onClick={handleRevoke}>
                {pending ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldOff className="size-3.5" />}
                Revoke access
              </Button>
            </>
          ) : (
            <Button size="sm" disabled={pending} onClick={handleEnable}>
              {pending ? <Loader2 className="size-3.5 animate-spin" /> : <KeyRound className="size-3.5" />}
              Enable access
            </Button>
          )}
        </div>
      </div>

      <Dialog open={!!temporaryPassword} onOpenChange={(open) => !open && setTemporaryPassword(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Access enabled</DialogTitle>
            <DialogDescription>
              Share this temporary password with the doctor directly — it won&apos;t be shown again. They can change
              it after signing in.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
            <code className="text-sm">{temporaryPassword}</code>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={handleCopyPassword}
              aria-label="Copy password"
            >
              <Copy className="size-3.5" />
            </Button>
          </div>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </>
  );
}
