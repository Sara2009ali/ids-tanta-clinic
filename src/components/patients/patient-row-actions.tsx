"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { archivePatient, deletePatient, restorePatient } from "@/lib/patients/actions";
import { hasPermission, PERMISSIONS } from "@/lib/authz/permissions";
import type { PatientStatus } from "@/types/domain";

export function PatientRowActions({
  patientId,
  status,
  patientName,
  permissions,
}: {
  patientId: string;
  status: PatientStatus;
  patientName: string;
  permissions: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const canEdit = hasPermission(permissions, PERMISSIONS.PATIENTS_EDIT);
  const canDelete = hasPermission(permissions, PERMISSIONS.PATIENTS_DELETE);

  function handleArchive() {
    startTransition(async () => {
      const result = await archivePatient(patientId);
      if ("error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${patientName} archived`);
        router.refresh();
      }
    });
  }

  function handleRestore() {
    startTransition(async () => {
      const result = await restorePatient(patientId);
      if ("error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${patientName} restored`);
        router.refresh();
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deletePatient(patientId);
      if ("error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${patientName} removed`);
        setDeleteOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
          <MoreHorizontal className="size-4" />
          <span className="sr-only">Actions for {patientName}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem render={<Link href={`/patients/${patientId}`} />}>
            <Eye /> View
          </DropdownMenuItem>
          {canEdit && (
            <DropdownMenuItem render={<Link href={`/patients/${patientId}/edit`} />}>
              <Pencil /> Edit
            </DropdownMenuItem>
          )}
          {(canEdit || canDelete) && <DropdownMenuSeparator />}
          {canEdit &&
            (status === "archived" ? (
              <DropdownMenuItem disabled={pending} onClick={handleRestore}>
                <ArchiveRestore /> Restore
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem disabled={pending} onClick={handleArchive}>
                <Archive /> Archive
              </DropdownMenuItem>
            ))}
          {canDelete && (
            <DropdownMenuItem
              variant="destructive"
              disabled={pending}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 /> Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {canDelete && (
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {patientName}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove the patient from all lists. This can be undone by a database
                admin, but not from this UI.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" disabled={pending} onClick={handleDelete}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
