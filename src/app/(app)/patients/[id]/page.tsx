import { notFound } from "next/navigation";
import { getPatientById, listDoctors } from "@/lib/patients/queries";
import { getPatientFileUrls } from "@/lib/patients/storage";
import {
  calculateAge,
  genderLabel,
  initials,
  medicalFlagLabel,
  MEDICAL_FLAG_KEYS,
} from "@/lib/patients/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PatientStatusBadge } from "@/components/patients/status-badge";
import { MedicalAlertBadge } from "@/components/patients/medical-alert-badge";
import { FileUploadZone, type ExistingPatientFile } from "@/components/patients/file-upload-zone";
import { PatientHeaderActions } from "@/components/patients/patient-header-actions";
import { PatientTimeline } from "@/components/patients/patient-timeline";
import { PatientAuditHistory } from "@/components/patients/patient-audit-history";
import { InvoicesTable } from "@/components/billing/invoices-table";
import { InvoiceFormSheet } from "@/components/billing/invoice-form-sheet";
import { PatientPaymentsHistory } from "@/components/billing/patient-payments-history";
import { getCurrentPermissions, requirePermission } from "@/lib/authz/session";
import { hasPermission, PERMISSIONS } from "@/lib/authz/permissions";
import { getPatientPayments, searchInvoices } from "@/lib/billing/queries";
import type { PatientFileType } from "@/types/domain";

export default async function PatientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission(PERMISSIONS.PATIENTS_VIEW);

  const { id } = await params;
  const result = await getPatientById(id);

  if (!result) {
    notFound();
  }

  const { patient, clinicalInfo, alerts, files, auditEntries } = result;
  const [doctors, permissions] = await Promise.all([listDoctors(), getCurrentPermissions()]);
  const preferredDentist = doctors.find((doctor) => doctor.id === patient.preferred_dentist_id);

  const canViewBilling = hasPermission(permissions, PERMISSIONS.BILLING_VIEW);
  const canEditBilling = hasPermission(permissions, PERMISSIONS.BILLING_EDIT);
  const [invoicesResult, patientPayments] = canViewBilling
    ? await Promise.all([searchInvoices({ patientId: patient.id, pageSize: 10 }), getPatientPayments(patient.id)])
    : [null, []];

  const [photoUrl, ...fileUrls] = await getPatientFileUrls([
    patient.photo_path,
    ...files.map((file) => file.storage_path),
  ]);

  const filesWithUrls = files.map((file, index) => ({ ...file, url: fileUrls[index] ?? null }));

  function existingFilesFor(fileType: PatientFileType): ExistingPatientFile[] {
    return filesWithUrls
      .filter((file) => file.file_type === fileType)
      .map((file) => ({
        id: file.id,
        url: file.url,
        name: file.description ?? file.storage_path.split("/").pop()!,
        uploadedAt: file.uploaded_at,
      }));
  }

  const age = calculateAge(patient.date_of_birth);
  const compactLine = [
    age !== null ? `${age} yrs` : null,
    patient.gender ? genderLabel(patient.gender) : null,
    patient.phone,
    patient.email,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Avatar size="lg" className="size-16">
            {photoUrl && <AvatarImage src={photoUrl} alt={patient.full_name ?? ""} />}
            <AvatarFallback className="bg-primary text-lg text-primary-foreground">
              {initials(patient.full_name ?? `${patient.first_name} ${patient.last_name}`)}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{patient.full_name}</h1>
              <PatientStatusBadge status={patient.status} />
            </div>
            <p className="text-sm text-muted-foreground">#{patient.patient_number}</p>
            {compactLine && <p className="text-sm text-muted-foreground">{compactLine}</p>}
            {alerts.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {alerts.map((alert) => (
                  <MedicalAlertBadge key={alert.id} label={alert.label} severity={alert.severity} />
                ))}
              </div>
            )}
          </div>
        </div>
        <PatientHeaderActions
          patientId={patient.id}
          status={patient.status}
          permissions={permissions}
        />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="medical">Medical History</TabsTrigger>
          <TabsTrigger value="dental">Dental History</TabsTrigger>
          <TabsTrigger value="timeline">Treatment Timeline</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="audit">Audit History</TabsTrigger>
          <TabsTrigger value="clinical-notes">Clinical Notes</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          {canViewBilling && <TabsTrigger value="invoices">Invoices</TabsTrigger>}
          {canViewBilling && <TabsTrigger value="payments">Payments</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="pt-6">
          <dl className="grid gap-x-6 gap-y-5 rounded-xl border border-border p-5 sm:grid-cols-2 lg:grid-cols-3">
            <InfoField label="Date of birth" value={patient.date_of_birth} />
            <InfoField label="Age" value={age !== null ? `${age} years` : null} />
            <InfoField label="Gender" value={patient.gender ? genderLabel(patient.gender) : null} />
            <InfoField label="Phone" value={patient.phone} />
            <InfoField label="Email" value={patient.email} />
            <InfoField label="Address" value={patient.address} />
            <InfoField label="National ID" value={patient.national_id} />
            <InfoField label="Occupation" value={patient.occupation} />
            <InfoField
              label="Emergency contact"
              value={
                patient.emergency_contact_name
                  ? `${patient.emergency_contact_name}${
                      patient.emergency_contact_phone ? ` (${patient.emergency_contact_phone})` : ""
                    }`
                  : null
              }
            />
            <InfoField label="Referral source" value={patient.referral_source} />
            <InfoField label="Insurance provider" value={patient.insurance_provider} />
            <InfoField label="Insurance policy number" value={patient.insurance_policy_number} />
          </dl>
        </TabsContent>

        <TabsContent value="medical" className="pt-6">
          {clinicalInfo ? (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <ListField label="Allergies" items={clinicalInfo.allergies} />
                <ListField label="Current medications" items={clinicalInfo.current_medications} />
                <ListField label="Medical conditions" items={clinicalInfo.medical_conditions} />
              </div>

              <div>
                <p className="mb-2 text-xs text-muted-foreground">Medical flags</p>
                <div className="flex flex-wrap gap-2">
                  {MEDICAL_FLAG_KEYS.map((key) => {
                    const isSet = clinicalInfo[key];
                    return (
                      <Badge
                        key={key}
                        variant="outline"
                        className={
                          isSet
                            ? "border-warning/30 bg-warning/15 text-amber-700 dark:text-amber-400"
                            : "text-muted-foreground"
                        }
                      >
                        {medicalFlagLabel(key)}: {isSet ? "Yes" : "No"}
                      </Badge>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-1 text-xs text-muted-foreground">Notes</p>
                <p className="rounded-xl border border-border p-4 text-sm whitespace-pre-wrap">
                  {clinicalInfo.notes || "No additional notes."}
                </p>
              </div>
            </div>
          ) : (
            <EmptyTab text="No medical history has been recorded for this patient yet." />
          )}
        </TabsContent>

        <TabsContent value="dental" className="pt-6">
          <dl className="grid gap-x-6 gap-y-5 rounded-xl border border-border p-5 sm:grid-cols-2">
            <InfoField label="Chief complaint" value={clinicalInfo?.chief_complaint} />
            <InfoField label="Preferred dentist" value={preferredDentist?.full_name} />
            <InfoField label="Referral source" value={patient.referral_source} />
            <InfoField label="Insurance provider" value={patient.insurance_provider} />
            <InfoField label="Insurance policy number" value={patient.insurance_policy_number} />
            <InfoField label="Dental history notes" value={clinicalInfo?.dental_history} />
          </dl>
        </TabsContent>

        <TabsContent value="timeline" className="pt-6">
          <PatientTimeline auditEntries={auditEntries} alerts={alerts} />
        </TabsContent>

        <TabsContent value="files" className="space-y-8 pt-6">
          <FileUploadZone
            clinicId={patient.clinic_id}
            patientId={patient.id}
            fileType="photo"
            label="Profile Photo"
            accept="image/*"
            multiple={false}
            setAsProfilePhoto
            existingFiles={existingFilesFor("photo")}
          />
          <Separator />
          <FileUploadZone
            clinicId={patient.clinic_id}
            patientId={patient.id}
            fileType="other"
            label="Documents"
            accept="application/pdf,image/*,.doc,.docx"
            existingFiles={existingFilesFor("other")}
          />
          <Separator />
          <FileUploadZone
            clinicId={patient.clinic_id}
            patientId={patient.id}
            fileType="radiograph"
            label="X-Rays"
            accept="image/*"
            existingFiles={existingFilesFor("radiograph")}
          />
          <Separator />
          <FileUploadZone
            clinicId={patient.clinic_id}
            patientId={patient.id}
            fileType="consent_form"
            label="Consent Forms"
            accept="application/pdf,image/*"
            existingFiles={existingFilesFor("consent_form")}
          />
        </TabsContent>

        <TabsContent value="audit" className="pt-6">
          <PatientAuditHistory auditEntries={auditEntries} />
        </TabsContent>

        <TabsContent value="clinical-notes" className="pt-6">
          <EmptyTab text="Clinical notes will appear here once the Clinical module ships." />
        </TabsContent>
        <TabsContent value="appointments" className="pt-6">
          <EmptyTab text="Appointments will appear here once the Scheduling module ships." />
        </TabsContent>
        {canViewBilling && invoicesResult && (
          <TabsContent value="invoices" className="space-y-4 pt-6">
            <div className="flex justify-end">
              {canEditBilling && (
                <InvoiceFormSheet initialPatient={{ id: patient.id, full_name: patient.full_name ?? "" }} />
              )}
            </div>
            {invoicesResult.rows.length > 0 ? (
              <InvoicesTable rows={invoicesResult.rows} hasFilters={false} />
            ) : (
              <EmptyTab text="No invoices yet for this patient." />
            )}
          </TabsContent>
        )}
        {canViewBilling && (
          <TabsContent value="payments" className="pt-6">
            <PatientPaymentsHistory payments={patientPayments} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{value || "—"}</dd>
    </div>
  );
}

function ListField({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="mb-2 text-xs text-muted-foreground">{label}</p>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <Badge key={item} variant="outline">
              {item}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">None recorded</p>
      )}
    </div>
  );
}

function EmptyTab({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
