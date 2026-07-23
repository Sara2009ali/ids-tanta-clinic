import { notFound } from "next/navigation";
import { getPatientById, listDoctors } from "@/lib/patients/queries";
import { PatientForm, type PatientFormDefaultValues } from "@/components/patients/patient-form";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { formatPatientName } from "@/lib/patients/utils";
import { requirePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { typography } from "@/lib/typography";

export default async function EditPatientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission(PERMISSIONS.PATIENTS_EDIT);

  const { id } = await params;

  const [result, doctors] = await Promise.all([getPatientById(id), listDoctors()]);

  if (!result) {
    notFound();
  }

  const { patient, clinicalInfo } = result;

  const defaultValues: PatientFormDefaultValues = {
    first_name: patient.first_name,
    last_name: patient.last_name,
    date_of_birth: patient.date_of_birth,
    gender: patient.gender,
    phone: patient.phone,
    email: patient.email,
    address: patient.address,
    national_id: patient.national_id,
    occupation: patient.occupation,
    emergency_contact_name: patient.emergency_contact_name,
    emergency_contact_phone: patient.emergency_contact_phone,
    allergies: clinicalInfo?.allergies?.join(", ") ?? "",
    current_medications: clinicalInfo?.current_medications?.join(", ") ?? "",
    medical_conditions: clinicalInfo?.medical_conditions?.join(", ") ?? "",
    is_pregnant: clinicalInfo?.is_pregnant ?? false,
    is_smoker: clinicalInfo?.is_smoker ?? false,
    has_hypertension: clinicalInfo?.has_hypertension ?? false,
    has_diabetes: clinicalInfo?.has_diabetes ?? false,
    has_heart_disease: clinicalInfo?.has_heart_disease ?? false,
    has_bleeding_disorder: clinicalInfo?.has_bleeding_disorder ?? false,
    clinical_notes: clinicalInfo?.notes ?? "",
    chief_complaint: clinicalInfo?.chief_complaint ?? "",
    referral_source: patient.referral_source,
    preferred_dentist_id: patient.preferred_dentist_id,
    insurance_provider: patient.insurance_provider,
    insurance_policy_number: patient.insurance_policy_number,
  };

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Patients", href: "/patients" },
          { label: formatPatientName(patient), href: `/patients/${id}` },
          { label: "Edit" },
        ]}
      />

      <div>
        <h1 className={typography.pageTitle}>
          Edit Patient — {formatPatientName(patient)}
        </h1>
        <p className="text-sm text-muted-foreground">Update the patient&apos;s record.</p>
      </div>
      <PatientForm mode="edit" patientId={id} defaultValues={defaultValues} doctors={doctors} />
    </div>
  );
}
