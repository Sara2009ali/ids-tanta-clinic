"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Loader2, Trash2, FileIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { recordPatientFile, deletePatientFile } from "@/lib/patients/actions";
import { buildPatientFilePath } from "@/lib/patients/utils";
import { Button } from "@/components/ui/button";
import type { PatientFileType } from "@/types/domain";

export interface ExistingPatientFile {
  id: string;
  url: string | null;
  name: string;
  uploadedAt: string;
}

export function FileUploadZone({
  clinicId,
  patientId,
  fileType,
  label,
  accept,
  multiple = true,
  setAsProfilePhoto = false,
  existingFiles = [],
}: {
  clinicId: string;
  patientId: string;
  fileType: PatientFileType;
  label: string;
  accept?: string;
  multiple?: boolean;
  setAsProfilePhoto?: boolean;
  existingFiles?: ExistingPatientFile[];
}) {
  const [uploading, setUploading] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    setUploading(true);
    const supabase = createClient();

    for (const file of Array.from(fileList)) {
      const path = buildPatientFilePath(clinicId, patientId, file.name);
      const { error: uploadError } = await supabase.storage.from("patient-files").upload(path, file);

      if (uploadError) {
        toast.error(`Failed to upload ${file.name}`);
        continue;
      }

      const result = await recordPatientFile({
        patientId,
        fileType,
        storagePath: path,
        description: file.name,
        setAsProfilePhoto,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${file.name} uploaded`);
      }
    }

    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleDelete(fileId: string) {
    setPendingDeleteId(fileId);
    const result = await deletePatientFile(fileId, patientId);
    setPendingDeleteId(null);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("File removed");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{label}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          Upload
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(event) => handleFiles(event.target.files)}
        />
      </div>

      {existingFiles.length > 0 ? (
        <ul className="space-y-1.5">
          {existingFiles.map((file) => (
            <li
              key={file.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
            >
              <a
                href={file.url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 items-center gap-2 truncate hover:underline"
              >
                <FileIcon className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{file.name}</span>
              </a>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={pendingDeleteId === file.id}
                onClick={() => handleDelete(file.id)}
                aria-label={`Remove ${file.name}`}
              >
                {pendingDeleteId === file.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No files uploaded yet.</p>
      )}
    </div>
  );
}
