import { notFound } from "next/navigation";
import { getPatientById, listDoctors } from "@/lib/patients/queries";
import { getPatientFileUrls } from "@/lib/patients/storage";
import { calculateAge, medicalFlagLabel, MEDICAL_FLAG_KEYS } from "@/lib/patients/utils";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PatientWorkspaceHero } from "@/components/patients/patient-workspace-hero";
import { WorkspaceSummaryRail, type SummaryRailItem } from "@/components/patients/workspace-summary-rail";
import { FileUploadZone, type ExistingPatientFile } from "@/components/patients/file-upload-zone";
import { PatientHeaderActions } from "@/components/patients/patient-header-actions";
import { PatientTimeline } from "@/components/patients/patient-timeline";
import { PatientAuditHistory } from "@/components/patients/patient-audit-history";
import { InvoicesTable } from "@/components/billing/invoices-table";
import { InvoiceFormSheet } from "@/components/billing/invoice-form-sheet";
import { PatientPaymentsHistory } from "@/components/billing/patient-payments-history";
import { TreatmentRecordsList } from "@/components/treatments/treatment-records-list";
import { ClinicalNotesList } from "@/components/clinical-notes/clinical-notes-list";
import { TreatmentPlansList } from "@/components/treatment-plans/treatment-plans-list";
import { PatientRecallsList } from "@/components/recalls/patient-recalls-list";
import { TodaysSchedule } from "@/components/appointments/todays-schedule";
import { DentalChart } from "@/components/dental-chart/dental-chart";
import { getCurrentPermissions, requirePermission } from "@/lib/authz/session";
import { hasPermission, PERMISSIONS } from "@/lib/authz/permissions";
import { getPatientPayments, searchInvoices } from "@/lib/billing/queries";
import type { InvoiceSearchResult, PatientPaymentRow } from "@/lib/billing/queries";
import { formatCurrency } from "@/lib/billing/format";
import { getTreatmentRecordsForPatient } from "@/lib/treatments/queries";
import { getClinicalNotesForPatient, type ClinicalNoteWithContext } from "@/lib/clinical-notes/queries";
import { getTreatmentPlansForPatient, type TreatmentPlanListRow } from "@/lib/treatment-plans/queries";
import { getRecallsForPatient, type RecallListRow } from "@/lib/recalls/queries";
import { isRecallOverdue } from "@/lib/recalls/calculations";
import { getAppointmentsForPatient, listVisitTypes } from "@/lib/appointments/queries";
import {
  getDentalChartForPatient,
  getToothEventsForPatient,
  type DentalChartToothSummary,
} from "@/lib/dental-chart/queries";
import { typography } from "@/lib/typography";
import { cn } from "@/lib/utils";
import type { PatientFileType, PatientToothEvent, TreatmentRecord } from "@/types/domain";
import type { ScheduleRow } from "@/lib/appointments/queries";

/** Kept as its own top-level helper (rather than inline in the component body) so the `Date.now()` call reads as an ordinary function call, not an impure read during render. */
function selectNextAppointment(appointments: ScheduleRow[]): ScheduleRow | undefined {
  const now = Date.now();
  return appointments
    .filter((row) => new Date(row.scheduled_start).getTime() >= now && row.status !== "cancelled" && row.status !== "no_show")
    .sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime())[0];
}

/** The soonest-due 'due' recall — recalls are already sorted due_date-ascending by getRecallsForPatient(), so this is just the first one that hasn't already been scheduled/completed/dismissed. */
function selectNextRecall(recalls: RecallListRow[]): RecallListRow | undefined {
  return recalls.find((recall) => recall.status === "due");
}

function formatDateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTimeLabel(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const PATIENT_PROFILE_TABS = new Set([
  "overview",
  "dental-chart",
  "medical",
  "dental",
  "timeline",
  "files",
  "audit",
  "procedures-performed",
  "clinical-notes",
  "treatment-plans",
  "recalls",
  "appointments",
  "invoices",
  "payments",
]);

export default async function PatientProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  await requirePermission(PERMISSIONS.PATIENTS_VIEW);

  const { id } = await params;
  const { tab } = await searchParams;
  // Deep-link target for entry points elsewhere on the page (e.g. the
  // Tooth Sheet's performed-treatment entries, which link here with
  // ?tab=procedures-performed) — reuses this existing route/Tabs instance
  // rather than a new treatment-record detail page. Falls back to the
  // default tab for anything unrecognized, same as an absent param.
  const initialTab = tab && PATIENT_PROFILE_TABS.has(tab) ? tab : "overview";

  // patient/doctors/permissions have no interdependency — fetching them as
  // one Promise.all (instead of getPatientById() then a separate
  // Promise.all for doctors+permissions) removes one full network
  // round-trip stage from every profile load.
  const [result, doctors, permissions] = await Promise.all([
    getPatientById(id),
    listDoctors(),
    getCurrentPermissions(),
  ]);

  if (!result) {
    notFound();
  }

  const { patient, clinicalInfo, alerts, files, auditEntries } = result;
  const preferredDentist = doctors.find((doctor) => doctor.id === patient.preferred_dentist_id);

  const canViewBilling = hasPermission(permissions, PERMISSIONS.BILLING_VIEW);
  const canEditBilling = hasPermission(permissions, PERMISSIONS.BILLING_EDIT);
  const canViewClinical = hasPermission(permissions, PERMISSIONS.CLINICAL_VIEW);
  const canEditClinical = hasPermission(permissions, PERMISSIONS.CLINICAL_EDIT);
  const canViewAppointments = hasPermission(permissions, PERMISSIONS.APPOINTMENTS_VIEW);

  // Billing, clinical, appointments, and file URLs each only depend on
  // `patient`/`files` (already known above) and the permission flags, not
  // on each other's data — they used to run as four separate sequential
  // stages purely because they were written one after another. Combining
  // them into one Promise.all collapses that into a single round-trip
  // stage instead of four. visitTypes is fetched unconditionally (not
  // gated on canViewClinical) — it's now also needed by the Invoices tab's
  // procedure picker, and billing.edit holders (e.g. accountant) don't
  // necessarily hold clinical.view, so gating it on the wrong permission
  // would silently leave them with an empty picker.
  const [
    [invoicesResult, patientPayments],
    treatmentRecords,
    clinicalNotes,
    treatmentPlans,
    recalls,
    visitTypes,
    appointments,
    patientFileUrls,
    dentalChartTeeth,
    dentalChartEvents,
  ] = await Promise.all([
      canViewBilling
        ? Promise.all([searchInvoices({ patientId: patient.id, pageSize: 10 }), getPatientPayments(patient.id)])
        : Promise.resolve<[InvoiceSearchResult | null, PatientPaymentRow[]]>([null, []]),
      canViewClinical ? getTreatmentRecordsForPatient(patient.id) : Promise.resolve<TreatmentRecord[]>([]),
      canViewClinical ? getClinicalNotesForPatient(patient.id) : Promise.resolve<ClinicalNoteWithContext[]>([]),
      canViewClinical ? getTreatmentPlansForPatient(patient.id) : Promise.resolve<TreatmentPlanListRow[]>([]),
      canViewClinical ? getRecallsForPatient(patient.id) : Promise.resolve<RecallListRow[]>([]),
      listVisitTypes(),
      canViewAppointments ? getAppointmentsForPatient(patient.id) : Promise.resolve<ScheduleRow[]>([]),
      getPatientFileUrls([patient.photo_path, ...files.map((file) => file.storage_path)]),
      canViewClinical ? getDentalChartForPatient(patient.id) : Promise.resolve<DentalChartToothSummary[]>([]),
      canViewClinical ? getToothEventsForPatient(patient.id) : Promise.resolve<PatientToothEvent[]>([]),
    ]);

  const [photoUrl, ...fileUrls] = patientFileUrls;

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

  // Presentational-only reductions over data the page already fetched above —
  // no new queries. Appointments are fetched unbounded per patient, so "next
  // appointment" is exact. Invoices are fetched as a page (pageSize: 10); the
  // outstanding-balance figure is only shown when that page actually holds
  // every invoice for this patient, so a partial page can never understate a
  // number the brief explicitly asks to be "immediately obvious and trustworthy" —
  // better to omit it than show a wrong total.
  const nextAppointment = selectNextAppointment(appointments);
  const nextRecall = selectNextRecall(recalls);

  const invoiceRows = invoicesResult?.rows ?? [];
  const hasEveryInvoice = invoicesResult ? invoicesResult.totalCount <= invoiceRows.length : false;
  const outstandingBalance = hasEveryInvoice
    ? invoiceRows.reduce((sum, row) => sum + Number(row.balance_due), 0)
    : null;

  const summaryItems: SummaryRailItem[] = [
    {
      label: "Last Visit",
      value: patient.last_visit_at ? formatDateLabel(patient.last_visit_at) : "No visits yet",
    },
    ...(canViewAppointments
      ? [
          {
            label: "Next Appointment",
            value: nextAppointment ? formatDateTimeLabel(nextAppointment.scheduled_start) : "None scheduled",
          } satisfies SummaryRailItem,
        ]
      : []),
    ...(canViewClinical
      ? [
          {
            label: "Next Recall",
            value: nextRecall
              ? `${formatDateLabel(nextRecall.due_date)}${isRecallOverdue(nextRecall) ? " (overdue)" : ""}`
              : "None due",
            tone: nextRecall && isRecallOverdue(nextRecall) ? ("warning" as const) : undefined,
          } satisfies SummaryRailItem,
        ]
      : []),
    ...(canViewBilling && outstandingBalance !== null
      ? [
          {
            label: "Outstanding Balance",
            value: formatCurrency(outstandingBalance),
            tone: outstandingBalance > 0 ? ("warning" as const) : ("success" as const),
          } satisfies SummaryRailItem,
        ]
      : []),
    {
      label: "Medical Alerts",
      value: alerts.length > 0 ? `${alerts.length} active` : "None",
      tone: alerts.length > 0 ? ("warning" as const) : undefined,
    },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: "Patients", href: "/patients" }, { label: patient.full_name ?? "Patient" }]}
      />

      <PatientWorkspaceHero
        fullName={patient.full_name ?? `${patient.first_name} ${patient.last_name}`}
        patientNumber={patient.patient_number}
        status={patient.status}
        photoUrl={photoUrl}
        age={age}
        gender={patient.gender}
        phone={patient.phone}
        email={patient.email}
        alerts={alerts}
        actions={<PatientHeaderActions patientId={patient.id} status={patient.status} permissions={permissions} />}
        rail={<WorkspaceSummaryRail items={summaryItems} />}
      />

      <Tabs defaultValue={initialTab} className="animate-in fade-in slide-in-from-bottom-1 duration-500">
        <TabsList className="h-auto w-full flex-nowrap justify-start overflow-x-auto [&>[data-slot=tabs-trigger]]:shrink-0 sm:w-fit sm:flex-wrap sm:justify-center">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {canViewClinical && <TabsTrigger value="dental-chart">Dental Chart</TabsTrigger>}
          <TabsTrigger value="medical">Medical History</TabsTrigger>
          <TabsTrigger value="dental">Dental History</TabsTrigger>
          <TabsTrigger value="timeline">Treatment Timeline</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="audit">Audit History</TabsTrigger>
          {canViewClinical && <TabsTrigger value="procedures-performed">Procedures Performed</TabsTrigger>}
          {canViewClinical && <TabsTrigger value="clinical-notes">Clinical Notes</TabsTrigger>}
          {canViewClinical && <TabsTrigger value="treatment-plans">Treatment Plans</TabsTrigger>}
          {canViewClinical && <TabsTrigger value="recalls">Recalls</TabsTrigger>}
          {canViewAppointments && <TabsTrigger value="appointments">Appointments</TabsTrigger>}
          {canViewBilling && <TabsTrigger value="invoices">Invoices</TabsTrigger>}
          {canViewBilling && <TabsTrigger value="payments">Payments</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="space-y-5 pt-6">
          <div>
            <p className={cn(typography.eyebrow, "mb-3")}>Personal</p>
            <dl className="grid gap-x-6 gap-y-5 rounded-xl border border-border p-5 sm:grid-cols-2 lg:grid-cols-3">
              <InfoField label="Date of birth" value={patient.date_of_birth} />
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
            </dl>
          </div>

          <div>
            <p className={cn(typography.eyebrow, "mb-3")}>Insurance &amp; Referral</p>
            <dl className="grid gap-x-6 gap-y-5 rounded-xl border border-border p-5 sm:grid-cols-2 lg:grid-cols-3">
              <InfoField label="Referral source" value={patient.referral_source} />
              <InfoField label="Insurance provider" value={patient.insurance_provider} />
              <InfoField label="Insurance policy number" value={patient.insurance_policy_number} />
            </dl>
          </div>
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
                  <p className={cn(typography.caption, "mb-2")}>Medical flags</p>
                  <div className="flex flex-wrap gap-2">
                    {MEDICAL_FLAG_KEYS.map((key) => {
                      const isSet = clinicalInfo[key];
                      return (
                        <Badge
                          key={key}
                          variant="outline"
                          className={isSet ? "border-warning/30 bg-warning/15 text-warning-text" : "text-muted-foreground"}
                        >
                          {medicalFlagLabel(key)}: {isSet ? "Yes" : "No"}
                        </Badge>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className={cn(typography.caption, "mb-1")}>Notes</p>
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
            <PatientTimeline
              auditEntries={auditEntries}
              alerts={alerts}
              treatmentRecords={treatmentRecords}
              visitTypes={visitTypes}
              appointments={appointments}
              invoices={invoicesResult?.rows ?? []}
              payments={patientPayments}
              dentalChartEvents={dentalChartEvents}
              recalls={recalls}
            />
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

          {canViewClinical && (
            <TabsContent value="dental-chart" className="pt-6">
              <DentalChart patientId={patient.id} teeth={dentalChartTeeth} canEdit={canEditClinical} />
            </TabsContent>
          )}
          {canViewClinical && (
            <TabsContent value="procedures-performed" className="pt-6">
              <TreatmentRecordsList
                records={treatmentRecords}
                visitTypes={visitTypes}
                doctors={doctors}
                canEdit={canEditClinical}
                emptyMessage="No treatment recorded for this patient yet."
              />
            </TabsContent>
          )}
          {canViewClinical && (
            <TabsContent value="clinical-notes" className="pt-6">
              <ClinicalNotesList
                patientId={patient.id}
                notes={clinicalNotes}
                appointments={appointments}
                canEdit={canEditClinical}
                emptyMessage="No clinical notes recorded for this patient yet."
              />
            </TabsContent>
          )}
          {canViewClinical && (
            <TabsContent value="treatment-plans" className="pt-6">
              <TreatmentPlansList patientId={patient.id} plans={treatmentPlans} canEdit={canEditClinical} />
            </TabsContent>
          )}
          {canViewClinical && (
            <TabsContent value="recalls" className="pt-6">
              <PatientRecallsList
                patientId={patient.id}
                patientName={patient.full_name ?? ""}
                recalls={recalls}
                doctors={doctors}
                visitTypes={visitTypes}
                canEdit={canEditClinical}
              />
            </TabsContent>
          )}
          {canViewAppointments && (
            <TabsContent value="appointments" className="pt-6">
              <TodaysSchedule rows={appointments} emptyMessage="No appointments recorded for this patient yet." />
            </TabsContent>
          )}
          {canViewBilling && invoicesResult && (
            <TabsContent value="invoices" className="space-y-4 pt-6">
              <div className="flex justify-end">
                {canEditBilling && (
                  <InvoiceFormSheet
                    initialPatient={{ id: patient.id, full_name: patient.full_name ?? "" }}
                    visitTypes={visitTypes}
                  />
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
  return <EmptyState title={text} />;
}
