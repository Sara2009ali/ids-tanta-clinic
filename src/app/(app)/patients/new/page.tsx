import { listDoctors } from "@/lib/patients/queries";
import { listPriceListOptions } from "@/lib/pricing/queries";
import { listInsurancePlanOptions } from "@/lib/insurance/queries";
import { PatientForm } from "@/components/patients/patient-form";
import { requirePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { typography } from "@/lib/typography";

export default async function NewPatientPage() {
  await requirePermission(PERMISSIONS.PATIENTS_CREATE);

  const [doctors, priceLists, insurancePlans] = await Promise.all([
    listDoctors(),
    listPriceListOptions(),
    listInsurancePlanOptions(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className={typography.pageTitle}>New Patient</h1>
        <p className="text-sm text-muted-foreground">Add a new patient record to the clinic.</p>
      </div>
      <PatientForm mode="create" doctors={doctors} priceLists={priceLists} insurancePlans={insurancePlans} />
    </div>
  );
}
