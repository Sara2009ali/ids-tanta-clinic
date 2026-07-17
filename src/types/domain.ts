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

export type DoctorWeeklyHours = Database["public"]["Tables"]["doctor_weekly_hours"]["Row"];
export type DoctorVacation = Database["public"]["Tables"]["doctor_vacations"]["Row"];
export type DoctorScheduleException = Database["public"]["Tables"]["doctor_schedule_exceptions"]["Row"];

export type Invoice = Database["public"]["Tables"]["invoices"]["Row"];
export type InvoiceItem = Database["public"]["Tables"]["invoice_items"]["Row"];
export type Payment = Database["public"]["Tables"]["payments"]["Row"];

// invoices.status and payments.method are text + check constraints, not
// Postgres enums (see 0011_billing.sql's header comment for why), so there's
// no generated Database["public"]["Enums"] entry for either — these mirror
// the check constraints by hand, same as how appointments.priority has no
// enum type either.
export type InvoiceStatus = "draft" | "unpaid" | "partially_paid" | "paid" | "cancelled";
export type PaymentMethod = "cash" | "visa" | "bank_transfer" | "wallet" | "other";
// payments.type (0012_billing_payment_model.sql) — a general transaction
// classification, not a refund-specific flag. Widening this to future
// categories (e.g. 'adjustment') is a check-constraint change only.
export type PaymentType = "payment" | "refund";

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

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  unpaid: "Unpaid",
  partially_paid: "Partially Paid",
  paid: "Paid",
  cancelled: "Cancelled",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  visa: "Visa",
  bank_transfer: "Bank Transfer",
  wallet: "Wallet",
  other: "Other",
};

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  payment: "Payment",
  refund: "Refund",
};
