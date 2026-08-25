"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImageOff, Loader2, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { updateClinicLogo, removeClinicLogo } from "@/lib/clinic/actions";
import { buildClinicLogoStoragePath, validateClinicLogoFile, CLINIC_LOGOS_BUCKET, ACCEPTED_CLINIC_LOGO_TYPES } from "@/lib/clinic/schema";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/components/locale-provider";

const ACCEPT_ATTR = ACCEPTED_CLINIC_LOGO_TYPES.join(",");

/**
 * Uploads directly from the browser under storage RLS (0035_clinic_admin.sql
 * scopes writes to this clinic's own folder), then calls updateClinicLogo()
 * to persist the resulting public URL onto clinics.logo_url — the exact
 * same "upload client-side, record server-side" split
 * FileUploadZone/recordPatientFile already established, so no service-role
 * client is needed for any part of this. Saves immediately on selection
 * (no separate "Save" step) — the same convention avatar/logo uploaders
 * elsewhere in this app's ecosystem already use, distinct from the
 * text-field form below it, which does have its own explicit save.
 */
export function ClinicLogoUploader({ clinicId, logoUrl }: { clinicId: string; logoUrl: string | null }) {
  const dict = useTranslation().clinic;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<string | null>(logoUrl);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;

    const validationError = validateClinicLogoFile(file);
    if (validationError) {
      toast.error(validationError === "invalid_type" ? dict.invalidLogoType : dict.logoTooLarge);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const path = buildClinicLogoStoragePath(clinicId, file.name);
      const { error: uploadError } = await supabase.storage.from(CLINIC_LOGOS_BUCKET).upload(path, file);

      if (uploadError) {
        console.error("ClinicLogoUploader: storage upload failed", uploadError);
        toast.error(dict.logoUploadFailed);
        if (inputRef.current) inputRef.current.value = "";
        return;
      }

      const result = await updateClinicLogo(path);
      if (result.error) {
        toast.error(result.error);
      } else {
        setPreview(result.logoUrl ?? null);
        router.refresh();
      }
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  function handleRemove() {
    startTransition(async () => {
      const result = await removeClinicLogo();
      if (result.error) {
        toast.error(result.error);
      } else {
        setPreview(null);
        toast.success(dict.logoRemovedToast);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/40">
        {preview ? (
          // A clinic-supplied logo, not a decorative/content image — no
          // meaningful alt text beyond identifying what it is.
          <img src={preview} alt={dict.logoLabel} className="size-full object-contain" />
        ) : (
          <ImageOff className="size-5 text-muted-foreground" aria-hidden="true" />
        )}
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => inputRef.current?.click()}>
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
            {preview ? dict.replaceLogo : dict.uploadLogo}
          </Button>
          {preview && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="hover:text-destructive"
              disabled={pending}
              onClick={handleRemove}
            >
              <Trash2 className="size-3.5" />
              {dict.removeLogo}
            </Button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_ATTR}
            className="hidden"
            aria-label={dict.uploadLogo}
            onChange={(event) => handleFileChange(event.target.files)}
          />
        </div>
        <p className="text-xs text-muted-foreground">{preview ? dict.logoDescription : dict.noLogo}</p>
      </div>
    </div>
  );
}
