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

export function PatientHeaderActions({
  patientId,
  status,
  permissions,
}: {
  patientId: string;
  status: PatientStatus;
  permissions: string[];
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
        toast.success(isArchived ? "Patient restored" : "Patient archived");
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
        toast.success("Patient deleted");
        router.push("/patients");
      }
    });
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      {canEdit && (
        <Button variant="outline" render={<Link href={`/patients/${patientId}/edit`} />}>
          <Pencil className="size-4" />
          Edit
        </Button>
      )}

      {canEdit && (
        <Button variant="outline" disabled={archivePending} onClick={handleArchiveToggle}>
          {archivePending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : isArchived ? (
            <ArchiveRestore className="size-4" />
          ) : (
            <Archive className="size-4" />
          )}
          {isArchived ? "Restore" : "Archive"}
        </Button>
      )}

      {canDelete && (
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="destructive" />}>
            <Trash2 className="size-4" />
            Delete
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this patient?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes the patient from all lists and reports. There&apos;s no
                restore-from-trash option in this phase, so only continue if you&apos;re sure.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={deletePending}
                onClick={handleDelete}
              >
                {deletePending && <Loader2 className="size-4 animate-spin" />}
                Delete patient
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
