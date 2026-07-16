import type { Database } from "@/types/database.generated";

export type StaffRole = Database["public"]["Enums"]["staff_role"];
export type PatientStatus = Database["public"]["Enums"]["patient_status"];
export type AlertSeverity = Database["public"]["Enums"]["alert_severity"];
export type PatientFileType = Database["public"]["Enums"]["patient_file_type"];
export type AppointmentStatus = Database["public"]["Enums"]["appointment_status"];

export type StaffProfile = Database["public"]["Tables"]["staff_profiles"]["Row"];
export type Patient = Database["public"]["Tables"]["patients"]["Row"];
export type PatientClinicalInfo = Database["public"]["Tables"]["patient_clinical_info"]["Row"];
export type PatientMedicalAlert = Database["public"]["Tables"]["patient_medical_alerts"]["Row"];
export type PatientFile = Database["public"]["Tables"]["patient_files"]["Row"];
export type AuditLogEntry = Database["public"]["Tables"]["audit_log"]["Row"];

export type Appointment = Database["public"]["Tables"]["appointments"]["Row"];
export type AppointmentStatusHistory = Database["public"]["Tables"]["appointment_status_history"]["Row"];
export type VisitType = Database["public"]["Tables"]["visit_types"]["Row"];
export type Chair = Database["public"]["Tables"]["chairs"]["Row"];

export type PatientSearchRow = Database["public"]["Functions"]["search_patients"]["Returns"][number];

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  checked_in: "Checked In",
  waiting: "Waiting",
  in_treatment: "In Treatment",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No Show",
};

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  doctor: "Doctor",
  assistant: "Assistant",
  reception: "Reception",
  accounting: "Accounting",
};

export const PATIENT_STATUS_LABELS: Record<PatientStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  archived: "Archived",
};
