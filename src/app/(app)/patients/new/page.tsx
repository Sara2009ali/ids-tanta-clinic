import { listDoctors } from "@/lib/patients/queries";
import { PatientForm } from "@/components/patients/patient-form";
import { requirePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";

export default async function NewPatientPage() {
  await requirePermission(PERMISSIONS.PATIENTS_CREATE);

  const doctors = await listDoctors();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New Patient</h1>
        <p className="text-sm text-muted-foreground">Add a new patient record to the clinic.</p>
      </div>
      <PatientForm mode="create" doctors={doctors} />
    </div>
  );
}
