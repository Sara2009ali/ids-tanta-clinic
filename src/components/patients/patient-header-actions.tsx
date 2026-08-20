"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Loader2, Pencil, Trash2 } from "lucide-react";
import { archivePatient, deletePatient, restorePatient } from "@/lib/patients/actions";
import { hasPermission, PERMISSIONS } from "@/lib/authz/permissions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { PatientStatus } from "@/types/domain";
import type { Dictionary } from "@/lib/i18n/types";

export function PatientHeaderActions({
  patientId,
  status,
  permissions,
  dict,
}: {
  patientId: string;
  status: PatientStatus;
  permissions: string[];
  dict: Dictionary["patientProfile"]["actions"];
}) {
  const router = useRouter();
  const [archivePending, startArchiveTransition] = useTransition();
  const [deletePending, startDeleteTransition] = useTransition();

  const isArchived = status === "archived";
  const canEdit = hasPermission(permissions, PERMISSIONS.PATIENTS_EDIT);
  const canDelete = hasPermission(permissions, PERMISSIONS.PATIENTS_DELETE);

  function handleArchiveToggle() {
    startArchiveTransition(async () => {
      const result = isArchived ? await restorePatient(patientId) : await archivePatient(patientId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(isArchived ? dict.restore : dict.archive);
        router.refresh();
      }
    });
  }

  function handleDelete() {
    startDeleteTransition(async () => {
      const result = await deletePatient(patientId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(dict.patientDeleted);
        router.push("/patients");
      }
    });
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {canEdit && (
        <Button render={<Link href={`/patients/${patientId}/edit`} />}>
          <Pencil className="size-4" />
          {dict.edit}
        </Button>
      )}

      {canEdit && (
        <Button variant="ghost" disabled={archivePending} onClick={handleArchiveToggle}>
          {archivePending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : isArchived ? (
            <ArchiveRestore className="size-4" />
          ) : (
            <Archive className="size-4" />
          )}
          {isArchived ? dict.restore : dict.archive}
        </Button>
      )}

      {canDelete && (
        <AlertDialog>
          {/* Visually separated from Edit/Archive — destructive, rare, and
              shouldn't compete with the routine actions for attention. */}
          <div className="ms-1 border-s border-border ps-2">
            <AlertDialogTrigger render={<Button variant="destructive" />}>
              <Trash2 className="size-4" />
              {dict.delete}
            </AlertDialogTrigger>
          </div>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{dict.deletePatientTitle}</AlertDialogTitle>
              <AlertDialogDescription>{dict.deletePatientDescription}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{dict.cancel}</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={deletePending}
                onClick={handleDelete}
              >
                {deletePending && <Loader2 className="size-4 animate-spin" />}
                {dict.deletePatientConfirm}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
