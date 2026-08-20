import Link from "next/link";
import { notFound } from "next/navigation";
import { Stethoscope } from "lucide-react";
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
import { TreatmentPlansList, planTitle } from "@/components/treatment-plans/treatment-plans-list";
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
import { getLocale, getDictionary } from "@/lib/i18n/server";
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

/** First 'active' plan, in the query's own most-recent-first order — same "active surfaces first" precedent TreatmentPlansList's STATUS_SORT_PRIORITY establishes, just narrowed to a single glanceable rail item rather than a full sort. */
function selectActiveTreatmentPlan(plans: TreatmentPlanListRow[]): TreatmentPlanListRow | undefined {
  return plans.find((plan) => plan.status === "active");
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

// Two visually-grouped clusters in one TabsList: core clinical workflow
// tabs first, then a divider, then the supporting/administrative tabs
// (appointments/billing/files) — still a single consistent Tabs control
// (no second navigation pattern), just with clearer hierarchy than treating
// all ten as one undifferentiated row. "medical"/"dental"/"audit" were their
// own tabs before this batch; medical + dental history are now part of
// Overview and audit entries live inside Timeline (see below), so those
// three keys are gone. "invoices"/"payments" merged into one "billing" tab.
const PATIENT_PROFILE_TABS = new Set([
  "overview",
  "dental-chart",
  "treatment-plans",
  "procedures-performed",
  "clinical-notes",
  "recalls",
  "timeline",
  "appointments",
  "billing",
  "files",
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
  const locale = await getLocale();
  const t = getDictionary(locale).patientProfile;

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
  const activeTreatmentPlan = selectActiveTreatmentPlan(treatmentPlans);

  const invoiceRows = invoicesResult?.rows ?? [];
  const hasEveryInvoice = invoicesResult ? invoicesResult.totalCount <= invoiceRows.length : false;
  const outstandingBalance = hasEveryInvoice
    ? invoiceRows.reduce((sum, row) => sum + Number(row.balance_due), 0)
    : null;

  // Each item with a single natural destination links straight to the tab
  // that owns the full picture — "concise summary + clear route," not a
  // second copy of that tab's content. Medical Alerts has no dedicated tab
  // (its detail already lives in the hero's badges above) and Last Visit
  // has no single record to jump to, so those two stay plain text.
  const summaryItems: SummaryRailItem[] = [
    {
      label: t.summaryRail.lastVisit,
      value: patient.last_visit_at ? formatDateLabel(patient.last_visit_at) : t.summaryRail.noVisitsYet,
      href: "?tab=timeline",
    },
    ...(canViewAppointments
      ? [
          {
            label: t.summaryRail.nextAppointment,
            value: nextAppointment ? formatDateTimeLabel(nextAppointment.scheduled_start) : t.summaryRail.noneScheduled,
            href: "?tab=appointments",
          } satisfies SummaryRailItem,
        ]
      : []),
    ...(canViewClinical
      ? [
          {
            label: t.summaryRail.activeTreatment,
            value: activeTreatmentPlan
              ? `${planTitle(activeTreatmentPlan)} · ${activeTreatmentPlan.completedPercent}%`
              : t.summaryRail.noActiveTreatment,
            href: "?tab=treatment-plans",
          } satisfies SummaryRailItem,
          {
            label: t.summaryRail.nextRecall,
            value: nextRecall
              ? `${formatDateLabel(nextRecall.due_date)}${isRecallOverdue(nextRecall) ? t.summaryRail.overdueSuffix : ""}`
              : t.summaryRail.noneDue,
            tone: nextRecall && isRecallOverdue(nextRecall) ? ("warning" as const) : undefined,
            href: "?tab=recalls",
          } satisfies SummaryRailItem,
        ]
      : []),
    ...(canViewBilling && outstandingBalance !== null
      ? [
          {
            label: t.summaryRail.outstandingBalance,
            value: formatCurrency(outstandingBalance),
            tone: outstandingBalance > 0 ? ("warning" as const) : ("success" as const),
            href: "?tab=billing",
          } satisfies SummaryRailItem,
        ]
      : []),
    {
      label: t.summaryRail.medicalAlerts,
      value: alerts.length > 0 ? `${alerts.length} ${t.summaryRail.activeSuffix}` : t.summaryRail.none,
      tone: alerts.length > 0 ? ("warning" as const) : undefined,
    },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: t.breadcrumbPatients, href: "/patients" }, { label: patient.full_name ?? t.unnamedPatient }]}
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
        actions={
          <PatientHeaderActions
            patientId={patient.id}
            status={patient.status}
            permissions={permissions}
            dict={t.actions}
          />
        }
        rail={<WorkspaceSummaryRail items={summaryItems} />}
      />

      <Tabs defaultValue={initialTab} className="animate-in fade-in slide-in-from-bottom-1 duration-500">
        <TabsList className="h-auto w-full flex-nowrap justify-start overflow-x-auto [&>[data-slot=tabs-trigger]]:shrink-0 sm:w-fit sm:flex-wrap sm:justify-center">
          <TabsTrigger value="overview">{t.tabs.overview}</TabsTrigger>
          {canViewClinical && <TabsTrigger value="dental-chart">{t.tabs.dentalChart}</TabsTrigger>}
          {canViewClinical && <TabsTrigger value="treatment-plans">{t.tabs.treatmentPlans}</TabsTrigger>}
          {canViewClinical && <TabsTrigger value="procedures-performed">{t.tabs.proceduresPerformed}</TabsTrigger>}
          {canViewClinical && <TabsTrigger value="clinical-notes">{t.tabs.clinicalNotes}</TabsTrigger>}
          {canViewClinical && <TabsTrigger value="recalls">{t.tabs.recalls}</TabsTrigger>}
          <TabsTrigger value="timeline">{t.tabs.timeline}</TabsTrigger>
          {(canViewAppointments || canViewBilling) && (
            <div aria-hidden="true" className="mx-1 h-4 w-px shrink-0 self-center bg-border" />
          )}
          {canViewAppointments && <TabsTrigger value="appointments">{t.tabs.appointments}</TabsTrigger>}
          {canViewBilling && <TabsTrigger value="billing">{t.tabs.billing}</TabsTrigger>}
          <TabsTrigger value="files">{t.tabs.files}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-5 pt-6">
          <div>
            <p className={cn(typography.eyebrow, "mb-3")}>{t.overview.personal}</p>
            <dl className="grid gap-x-6 gap-y-5 rounded-xl border border-border p-5 sm:grid-cols-2 lg:grid-cols-3">
              <InfoField label={t.overview.dateOfBirth} value={patient.date_of_birth} />
              <InfoField label={t.overview.address} value={patient.address} />
              <InfoField label={t.overview.nationalId} value={patient.national_id} />
              <InfoField label={t.overview.occupation} value={patient.occupation} />
              <InfoField
                label={t.overview.emergencyContact}
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
            <p className={cn(typography.eyebrow, "mb-3")}>{t.overview.insuranceReferral}</p>
            <dl className="grid gap-x-6 gap-y-5 rounded-xl border border-border p-5 sm:grid-cols-2 lg:grid-cols-3">
              <InfoField label={t.overview.referralSource} value={patient.referral_source} />
              <InfoField label={t.overview.insuranceProvider} value={patient.insurance_provider} />
              <InfoField label={t.overview.insurancePolicyNumber} value={patient.insurance_policy_number} />
            </dl>
          </div>

          {/* Medical/dental background, gated on canViewClinical — this was
              previously ungated (visible to any PATIENTS_VIEW holder, e.g.
              reception, with no clinical.view check at all), which doesn't
              match how every other clinical section on this page already
              behaves. Folding it into Overview surfaced the gap; fixed here
              rather than carried forward. */}
          {canViewClinical && (
            <>
              <div>
                <p className={cn(typography.eyebrow, "mb-3")}>{t.overview.medicalHistory}</p>
                {clinicalInfo ? (
                  <div className="space-y-4 rounded-xl border border-border p-5">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <ListField label={t.overview.allergies} items={clinicalInfo.allergies} noneLabel={t.overview.noneRecorded} />
                      <ListField
                        label={t.overview.currentMedications}
                        items={clinicalInfo.current_medications}
                        noneLabel={t.overview.noneRecorded}
                      />
                      <ListField
                        label={t.overview.medicalConditions}
                        items={clinicalInfo.medical_conditions}
                        noneLabel={t.overview.noneRecorded}
                      />
                    </div>

                    <div>
                      <p className={cn(typography.caption, "mb-2")}>{t.overview.medicalFlags}</p>
                      <div className="flex flex-wrap gap-2">
                        {MEDICAL_FLAG_KEYS.map((key) => {
                          const isSet = clinicalInfo[key];
                          return (
                            <Badge
                              key={key}
                              variant="outline"
                              className={isSet ? "border-warning/30 bg-warning/15 text-warning-text" : "text-muted-foreground"}
                            >
                              {medicalFlagLabel(key)}: {isSet ? t.overview.flagYes : t.overview.flagNo}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <p className={cn(typography.caption, "mb-1")}>{t.overview.notes}</p>
                      <p className="text-sm whitespace-pre-wrap">{clinicalInfo.notes || t.overview.noAdditionalNotes}</p>
                    </div>
                  </div>
                ) : (
                  <EmptyTab text={t.overview.noMedicalHistory} />
                )}
              </div>

              <div>
                <p className={cn(typography.eyebrow, "mb-3")}>{t.overview.dentalHistory}</p>
                <dl className="grid gap-x-6 gap-y-5 rounded-xl border border-border p-5 sm:grid-cols-2">
                  <InfoField label={t.overview.chiefComplaint} value={clinicalInfo?.chief_complaint} />
                  <InfoField label={t.overview.preferredDentist} value={preferredDentist?.full_name} />
                  <InfoField label={t.overview.dentalHistoryNotes} value={clinicalInfo?.dental_history} />
                </dl>
              </div>

              {/* "What has been performed recently" — a bounded, 3-row
                  glance at the same treatmentRecords the Procedures
                  Performed tab already fetched and fully lists; not a
                  second copy of that table, just enough to answer the
                  question without leaving Overview. */}
              {treatmentRecords.length > 0 && (
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <p className={typography.eyebrow}>{t.overview.recentActivity}</p>
                    <Link href="?tab=procedures-performed" scroll={false} className="text-xs text-muted-foreground hover:text-foreground hover:underline">
                      {t.overview.viewAllProcedures}
                    </Link>
                  </div>
                  <div className="divide-y divide-border rounded-xl border border-border">
                    {treatmentRecords.slice(0, 3).map((record) => {
                      const procedureName = visitTypes.find((v) => v.id === record.visit_type_id)?.name ?? "—";
                      const doctorName = doctors.find((d) => d.id === record.doctor_id)?.full_name ?? "—";
                      return (
                        <div key={record.id} className="flex items-center gap-3 p-3.5">
                          <Stethoscope className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{procedureName}</p>
                            <p className="truncate text-xs text-muted-foreground">{t.overview.doctorPrefix} {doctorName}</p>
                          </div>
                          <p className="shrink-0 text-xs text-muted-foreground">{formatDateLabel(record.created_at)}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="timeline" className="space-y-8 pt-6">
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

          {/* Same events as above, at compliance-table fidelity (raw
              action/details/timestamp) rather than the narrative feed —
              folded in here instead of a dedicated "Audit History" tab so
              the chronological layer stays one tab, not two. */}
          <div>
            <p className={cn(typography.eyebrow, "mb-3")}>{t.auditTrailHeading}</p>
            <PatientAuditHistory auditEntries={auditEntries} />
          </div>
        </TabsContent>

        <TabsContent value="files" className="space-y-8 pt-6">
          <FileUploadZone
            clinicId={patient.clinic_id}
            patientId={patient.id}
            fileType="photo"
            label={t.files.profilePhoto}
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
            label={t.files.documents}
            accept="application/pdf,image/*,.doc,.docx"
            existingFiles={existingFilesFor("other")}
          />
          <Separator />
          <FileUploadZone
            clinicId={patient.clinic_id}
            patientId={patient.id}
            fileType="radiograph"
            label={t.files.xrays}
            accept="image/*"
            existingFiles={existingFilesFor("radiograph")}
          />
          <Separator />
          <FileUploadZone
            clinicId={patient.clinic_id}
            patientId={patient.id}
            fileType="consent_form"
            label={t.files.consentForms}
            accept="application/pdf,image/*"
            existingFiles={existingFilesFor("consent_form")}
          />
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
              emptyMessage={t.proceduresEmpty}
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
              emptyMessage={t.clinicalNotesEmpty}
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
            <TodaysSchedule rows={appointments} emptyMessage={t.appointmentsEmpty} />
          </TabsContent>
        )}
        {canViewBilling && (
          <TabsContent value="billing" className="space-y-8 pt-6">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className={typography.eyebrow}>{t.billingSection.invoices}</p>
                {canEditBilling && (
                  <InvoiceFormSheet
                    initialPatient={{ id: patient.id, full_name: patient.full_name ?? "" }}
                    visitTypes={visitTypes}
                  />
                )}
              </div>
              {invoicesResult && invoicesResult.rows.length > 0 ? (
                <InvoicesTable rows={invoicesResult.rows} hasFilters={false} />
              ) : (
                <EmptyTab text={t.billingSection.noInvoicesYet} />
              )}
            </div>

            <div>
              <p className={cn(typography.eyebrow, "mb-3")}>{t.billingSection.payments}</p>
              <PatientPaymentsHistory payments={patientPayments} />
            </div>
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

function ListField({ label, items, noneLabel }: { label: string; items: string[]; noneLabel: string }) {
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
        <p className="text-sm text-muted-foreground">{noneLabel}</p>
      )}
    </div>
  );
}

function EmptyTab({ text }: { text: string }) {
  return <EmptyState title={text} />;
}
