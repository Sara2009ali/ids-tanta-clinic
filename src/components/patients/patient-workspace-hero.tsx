import type { ReactNode } from "react";
import { Mail, Phone } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PatientStatusBadge } from "@/components/patients/status-badge";
import { MedicalAlertBadge } from "@/components/patients/medical-alert-badge";
import { genderLabel, initials } from "@/lib/patients/utils";
import { typography } from "@/lib/typography";
import { cn } from "@/lib/utils";
import type { PatientMedicalAlert, PatientStatus } from "@/types/domain";

/**
 * The identity + "what needs my attention right now" surface for a patient's
 * workspace — replaces the old sticky left-column card. Everything here is
 * either already on the page (patient row, resolved photo URL, alerts) or a
 * pure display-only reduction over data the page already fetched (next
 * appointment, outstanding balance) — no new queries live behind this.
 */
export function PatientWorkspaceHero({
  fullName,
  patientNumber,
  status,
  photoUrl,
  age,
  gender,
  phone,
  email,
  alerts,
  actions,
  rail,
}: {
  fullName: string;
  patientNumber: string;
  status: PatientStatus;
  photoUrl: string | null;
  age: number | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
  alerts: PatientMedicalAlert[];
  actions: ReactNode;
  rail: ReactNode;
}) {
  return (
    <div className="animate-in fade-in slide-in-from-top-2 overflow-hidden rounded-2xl border border-border bg-card shadow-elevation-low duration-500">
      <div className="flex flex-col gap-6 p-6 sm:p-7 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-1 flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar size="lg" className="size-20 shrink-0 sm:size-24">
            {photoUrl && <AvatarImage src={photoUrl} alt={fullName} />}
            <AvatarFallback className="bg-primary text-2xl text-primary-foreground">
              {initials(fullName)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className={cn(typography.pageTitle, "text-2xl")}>{fullName}</h1>
              <PatientStatusBadge status={status} />
            </div>
            <p className="text-sm text-muted-foreground">
              #{patientNumber}
              {age !== null && ` · ${age} yrs`}
              {gender && ` · ${genderLabel(gender)}`}
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {phone && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="size-3.5" />
                  {phone}
                </span>
              )}
              {email && (
                <span className="inline-flex items-center gap-1.5 truncate">
                  <Mail className="size-3.5 shrink-0" />
                  <span className="truncate">{email}</span>
                </span>
              )}
            </div>
            {alerts.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {alerts.map((alert) => (
                  <MedicalAlertBadge key={alert.id} label={alert.label} severity={alert.severity} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-start gap-2">{actions}</div>
      </div>

      {rail}
    </div>
  );
}
