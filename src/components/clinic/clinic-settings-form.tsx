"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { updateClinic } from "@/lib/clinic/actions";
import { CLINIC_TIMEZONE_OPTIONS } from "@/lib/onboarding/schema";
import { ClinicLogoUploader } from "@/components/clinic/clinic-logo-uploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "@/components/locale-provider";
import { typography } from "@/lib/typography";
import type { ClinicForSettings } from "@/lib/clinic/queries";

export function ClinicSettingsForm({ clinic }: { clinic: ClinicForSettings }) {
  const dict = useTranslation().clinic;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateClinic(formData);
      if (result.error) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
      } else {
        setError(null);
        setFieldErrors({});
        toast.success(dict.savedToast);
        router.refresh();
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-8">
      <div className="space-y-4">
        <div>
          <h2 className={typography.sectionTitle}>{dict.identitySectionTitle}</h2>
          <p className="text-sm text-muted-foreground">{dict.identitySectionDescription}</p>
        </div>

        <FormField label={dict.logoLabel} htmlFor="clinic_logo">
          <ClinicLogoUploader clinicId={clinic.id} logoUrl={clinic.logo_url} />
        </FormField>

        <FormField label={dict.nameLabel} htmlFor="name" required error={fieldErrors.name}>
          <Input
            id="name"
            name="name"
            defaultValue={clinic.name}
            placeholder={dict.namePlaceholder}
            required
            aria-invalid={!!fieldErrors.name}
          />
        </FormField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label={dict.phoneLabel} htmlFor="phone" error={fieldErrors.phone}>
            <Input id="phone" name="phone" defaultValue={clinic.phone ?? ""} aria-invalid={!!fieldErrors.phone} />
          </FormField>
          <FormField label={dict.addressLabel} htmlFor="address" error={fieldErrors.address}>
            <Input id="address" name="address" defaultValue={clinic.address ?? ""} aria-invalid={!!fieldErrors.address} />
          </FormField>
        </div>
      </div>

      <div className="space-y-4 border-t border-border pt-6">
        <div>
          <h2 className={typography.sectionTitle}>{dict.regionalSectionTitle}</h2>
          <p className="text-sm text-muted-foreground">{dict.regionalSectionDescription}</p>
        </div>

        <FormField label={dict.timezoneLabel} htmlFor="timezone" error={fieldErrors.timezone} className="max-w-xs">
          <Select name="timezone" defaultValue={clinic.timezone}>
            <SelectTrigger id="timezone" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CLINIC_TIMEZONE_OPTIONS.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-end border-t border-border pt-6">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {dict.save}
        </Button>
      </div>
    </form>
  );
}
