"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensurePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { writeAuditLog } from "@/lib/audit/log";
import { patientFormSchema, patientFormValuesFromFormData, type PatientFormValues } from "@/lib/patients/schema";
import { findPatientByPhone } from "@/lib/patients/queries";
import type { PatientFileType } from "@/types/domain";

export interface PatientActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
  patientId?: string;
}

const DUPLICATE_KEY_ERROR = "23505";

function fieldErrorsFromZod(error: import("zod").ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

function patientRowFromValues(values: PatientFormValues, clinicId: string) {
  return {
    clinic_id: clinicId,
    first_name: values.first_name,
    last_name: values.last_name,
    date_of_birth: values.date_of_birth ?? null,
    gender: values.gender ?? null,
    phone: values.phone ?? null,
    email: values.email ?? null,
    address: values.address ?? null,
    national_id: values.national_id ?? null,
    occupation: values.occupation ?? null,
    emergency_contact_name: values.emergency_contact_name ?? null,
    emergency_contact_phone: values.emergency_contact_phone ?? null,
    referral_source: values.referral_source ?? null,
    preferred_dentist_id: values.preferred_dentist_id ?? null,
    insurance_provider: values.insurance_provider ?? null,
    insurance_policy_number: values.insurance_policy_number ?? null,
  };
}

function clinicalInfoRowFromValues(values: PatientFormValues) {
  return {
    allergies: values.allergies,
    current_medications: values.current_medications,
    medical_conditions: values.medical_conditions,
    is_pregnant: values.is_pregnant,
    is_smoker: values.is_smoker,
    has_hypertension: values.has_hypertension,
    has_diabetes: values.has_diabetes,
    has_heart_disease: values.has_heart_disease,
    has_bleeding_disorder: values.has_bleeding_disorder,
    chief_complaint: values.chief_complaint ?? null,
    notes: values.clinical_notes ?? null,
  };
}

export async function createPatient(formData: FormData): Promise<PatientActionState> {
  const authz = await ensurePermission(PERMISSIONS.PATIENTS_CREATE);
  if (!authz.ok) {
    return { error: authz.error };
  }
  const staff = authz.staff;
  if (!staff.clinic_id) {
    return { error: "Your account isn't assigned to a clinic yet." };
  }

  const parsed = patientFormSchema.safeParse(patientFormValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const values = parsed.data;

  if (values.phone) {
    const existing = await findPatientByPhone(staff.clinic_id, values.phone);
    if (existing) {
      return {
        error: `A patient with this phone number already exists (${existing.full_name}).`,
        fieldErrors: { phone: "Phone number already in use" },
      };
    }
  }

  const supabase = await createClient();
  const { data: patient, error } = await supabase
    .from("patients")
    .insert({ ...patientRowFromValues(values, staff.clinic_id), created_by: staff.id })
    .select()
    .single();

  if (error || !patient) {
    if (error?.code === DUPLICATE_KEY_ERROR) {
      return {
        error: "A patient with this phone number already exists.",
        fieldErrors: { phone: "Phone number already in use" },
      };
    }
    console.error("createPatient: patient insert failed", error);
    return { error: "Couldn't save the patient. Please try again." };
  }

  const { error: clinicalError } = await supabase.from("patient_clinical_info").insert({
    patient_id: patient.id,
    clinic_id: staff.clinic_id,
    ...clinicalInfoRowFromValues(values),
    updated_by: staff.id,
  });

  if (clinicalError) {
    console.error("createPatient: clinical info insert failed", clinicalError);
    await supabase.from("patients").delete().eq("id", patient.id);
    return { error: "Couldn't save the patient's medical information. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "patient.created",
    entityType: "patient",
    entityId: patient.id,
    changes: { full_name: patient.full_name, patient_number: patient.patient_number },
  });

  revalidatePath("/patients");
  return { success: true, patientId: patient.id };
}

export async function updatePatient(patientId: string, formData: FormData): Promise<PatientActionState> {
  const authz = await ensurePermission(PERMISSIONS.PATIENTS_EDIT);
  if (!authz.ok) {
    return { error: authz.error };
  }
  const staff = authz.staff;
  if (!staff.clinic_id) {
    return { error: "Your account isn't assigned to a clinic yet." };
  }

  const parsed = patientFormSchema.safeParse(patientFormValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const values = parsed.data;

  if (values.phone) {
    const existing = await findPatientByPhone(staff.clinic_id, values.phone, patientId);
    if (existing) {
      return {
        error: `A patient with this phone number already exists (${existing.full_name}).`,
        fieldErrors: { phone: "Phone number already in use" },
      };
    }
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("patients")
    .update({ ...patientRowFromValues(values, staff.clinic_id), updated_by: staff.id })
    .eq("id", patientId);

  if (error) {
    if (error.code === DUPLICATE_KEY_ERROR) {
      return {
        error: "A patient with this phone number already exists.",
        fieldErrors: { phone: "Phone number already in use" },
      };
    }
    console.error("updatePatient: patient update failed", error);
    return { error: "Couldn't save the patient. Please try again." };
  }

  const { error: clinicalError } = await supabase.from("patient_clinical_info").upsert(
    {
      patient_id: patientId,
      clinic_id: staff.clinic_id,
      ...clinicalInfoRowFromValues(values),
      updated_by: staff.id,
    },
    { onConflict: "patient_id" },
  );

  if (clinicalError) {
    console.error("updatePatient: clinical info upsert failed", clinicalError);
    return { error: "Patient details were saved, but medical information failed to update." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "patient.updated",
    entityType: "patient",
    entityId: patientId,
  });

  revalidatePath("/patients");
  revalidatePath(`/patients/${patientId}`);
  return { success: true, patientId };
}

async function setPatientStatus(patientId: string, status: "active" | "inactive" | "archived", action: string) {
  const authz = await ensurePermission(PERMISSIONS.PATIENTS_EDIT);
  if (!authz.ok) {
    return { error: authz.error };
  }
  const staff = authz.staff;
  if (!staff.clinic_id) {
    return { error: "Your account isn't assigned to a clinic yet." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("patients")
    .update({ status, updated_by: staff.id })
    .eq("id", patientId);

  if (error) {
    console.error(`${action} failed`, error);
    return { error: "Something went wrong. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action,
    entityType: "patient",
    entityId: patientId,
  });

  revalidatePath("/patients");
  revalidatePath(`/patients/${patientId}`);
  return { success: true };
}

export async function archivePatient(patientId: string) {
  return setPatientStatus(patientId, "archived", "patient.archived");
}

export async function restorePatient(patientId: string) {
  return setPatientStatus(patientId, "active", "patient.restored");
}

export async function deletePatient(patientId: string) {
  const authz = await ensurePermission(PERMISSIONS.PATIENTS_DELETE);
  if (!authz.ok) {
    return { error: authz.error };
  }
  const staff = authz.staff;
  if (!staff.clinic_id) {
    return { error: "Your account isn't assigned to a clinic yet." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("patients")
    .update({ deleted_at: new Date().toISOString(), updated_by: staff.id })
    .eq("id", patientId);

  if (error) {
    console.error("deletePatient failed", error);
    return { error: "Something went wrong. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "patient.deleted",
    entityType: "patient",
    entityId: patientId,
  });

  revalidatePath("/patients");
  return { success: true };
}

export interface RecordPatientFileInput {
  patientId: string;
  fileType: PatientFileType;
  storagePath: string;
  description?: string;
  setAsProfilePhoto?: boolean;
}

/** Records metadata for a file the client already uploaded directly to Storage. */
export async function recordPatientFile(input: RecordPatientFileInput) {
  const authz = await ensurePermission(PERMISSIONS.PATIENTS_EDIT);
  if (!authz.ok) {
    return { error: authz.error };
  }
  const staff = authz.staff;
  if (!staff.clinic_id) {
    return { error: "Your account isn't assigned to a clinic yet." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("patient_files").insert({
    patient_id: input.patientId,
    clinic_id: staff.clinic_id,
    file_type: input.fileType,
    storage_path: input.storagePath,
    description: input.description ?? null,
    uploaded_by: staff.id,
  });

  if (error) {
    console.error("recordPatientFile failed", error);
    return { error: "The file uploaded, but we couldn't save it to the patient's record." };
  }

  if (input.setAsProfilePhoto) {
    await supabase
      .from("patients")
      .update({ photo_path: input.storagePath, updated_by: staff.id })
      .eq("id", input.patientId);
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "patient.file_uploaded",
    entityType: "patient",
    entityId: input.patientId,
    changes: { file_type: input.fileType },
  });

  revalidatePath(`/patients/${input.patientId}`);
  return { success: true };
}

export async function deletePatientFile(fileId: string, patientId: string) {
  const authz = await ensurePermission(PERMISSIONS.PATIENTS_EDIT);
  if (!authz.ok) {
    return { error: authz.error };
  }
  const staff = authz.staff;
  if (!staff.clinic_id) {
    return { error: "Your account isn't assigned to a clinic yet." };
  }

  const supabase = await createClient();
  const { data: file } = await supabase.from("patient_files").select("storage_path").eq("id", fileId).single();

  const { error } = await supabase.from("patient_files").delete().eq("id", fileId);
  if (error) {
    console.error("deletePatientFile failed", error);
    return { error: "Couldn't remove the file. Please try again." };
  }

  if (file?.storage_path) {
    await supabase.storage.from("patient-files").remove([file.storage_path]);
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "patient.file_deleted",
    entityType: "patient",
    entityId: patientId,
  });

  revalidatePath(`/patients/${patientId}`);
  return { success: true };
}
