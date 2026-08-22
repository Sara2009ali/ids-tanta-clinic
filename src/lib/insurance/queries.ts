import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Insurer, InsurancePlan, PatientInsurance } from "@/types/domain";

export interface InsurancePlanWithInsurer extends InsurancePlan {
  insurer_name: string;
}

export interface InsurerWithPlans extends Insurer {
  plans: InsurancePlanWithInsurer[];
}

/** Every insurer and its plans, for the Settings > Insurance management page. */
export async function listInsurersWithPlans(): Promise<InsurerWithPlans[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("insurers")
    .select("*, insurance_plans(*)")
    .order("name");

  if (error) {
    console.error("listInsurersWithPlans failed", error);
    return [];
  }

  return (data ?? []).map((row) => {
    const { insurance_plans, ...insurer } = row as Insurer & { insurance_plans: InsurancePlan[] };
    return {
      ...insurer,
      plans: insurance_plans
        .map((plan) => ({ ...plan, insurer_name: insurer.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  });
}

export interface InsurancePlanOption {
  id: string;
  name: string;
  insurer_name: string;
}

/** Active plans selectable for a patient's insurance, grouped implicitly by insurer via the label. */
export async function listInsurancePlanOptions(): Promise<InsurancePlanOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("insurance_plans")
    .select("id, name, is_active, insurers!inner(name, is_active)")
    .eq("is_active", true)
    .eq("insurers.is_active", true)
    .order("name");

  if (error) {
    console.error("listInsurancePlanOptions failed", error);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    insurer_name: (row.insurers as unknown as { name: string }).name,
  }));
}

export interface PatientInsuranceDetail extends PatientInsurance {
  plan_name: string | null;
  insurer_name: string | null;
  coverage_percent: number | null;
}

/** The patient's insurance record (plan + membership info), or null if they've never had one set. */
export async function getPatientInsurance(patientId: string): Promise<PatientInsuranceDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("patient_insurance")
    .select("*, insurance_plans(name, coverage_percent, insurers(name))")
    .eq("patient_id", patientId)
    .maybeSingle();

  if (!data) return null;

  const { insurance_plans, ...record } = data as PatientInsurance & {
    insurance_plans: { name: string; coverage_percent: number; insurers: { name: string } } | null;
  };

  return {
    ...record,
    plan_name: insurance_plans?.name ?? null,
    insurer_name: insurance_plans?.insurers?.name ?? null,
    coverage_percent: insurance_plans?.coverage_percent ?? null,
  };
}
