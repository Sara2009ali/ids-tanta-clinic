import { z } from "zod";

/** "09:30" -> 570. Used both by the Zod transforms below and by the management UI for display. */
export function minutesFromTimeString(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

/** 570 -> "09:30". Inverse of `minutesFromTimeString`. */
export function timeStringFromMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const timeString = z.string().regex(TIME_PATTERN, "Enter a valid time");
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date");

export const weeklyHoursBlockSchema = z
  .object({
    doctor_id: z.string().min(1, "Select a doctor"),
    day_of_week: z.coerce.number().int().min(0).max(6),
    start_time: timeString,
    end_time: timeString,
  })
  .refine((values) => minutesFromTimeString(values.end_time) > minutesFromTimeString(values.start_time), {
    message: "End time must be after start time",
    path: ["end_time"],
  })
  .transform((values) => ({
    doctor_id: values.doctor_id,
    day_of_week: values.day_of_week,
    start_minutes: minutesFromTimeString(values.start_time),
    end_minutes: minutesFromTimeString(values.end_time),
  }));

export type WeeklyHoursBlockValues = z.infer<typeof weeklyHoursBlockSchema>;

export const vacationSchema = z
  .object({
    doctor_id: z.string().min(1, "Select a doctor"),
    start_date: dateString,
    end_date: dateString,
    reason: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value ? value : undefined)),
  })
  .refine((values) => values.end_date >= values.start_date, {
    message: "End date must be on or after the start date",
    path: ["end_date"],
  });

export type VacationValues = z.infer<typeof vacationSchema>;

export const scheduleExceptionSchema = z
  .object({
    doctor_id: z.string().min(1, "Select a doctor"),
    exception_date: dateString,
    start_time: timeString,
    end_time: timeString,
    reason: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value ? value : undefined)),
  })
  .refine((values) => minutesFromTimeString(values.end_time) > minutesFromTimeString(values.start_time), {
    message: "End time must be after start time",
    path: ["end_time"],
  })
  .transform((values) => ({
    doctor_id: values.doctor_id,
    exception_date: values.exception_date,
    start_minutes: minutesFromTimeString(values.start_time),
    end_minutes: minutesFromTimeString(values.end_time),
    reason: values.reason,
  }));

export type ScheduleExceptionValues = z.infer<typeof scheduleExceptionSchema>;

function str(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

export function weeklyHoursBlockValuesFromFormData(formData: FormData) {
  return {
    doctor_id: str(formData, "doctor_id") ?? "",
    day_of_week: str(formData, "day_of_week") ?? "",
    start_time: str(formData, "start_time") ?? "",
    end_time: str(formData, "end_time") ?? "",
  };
}

export function vacationValuesFromFormData(formData: FormData) {
  return {
    doctor_id: str(formData, "doctor_id") ?? "",
    start_date: str(formData, "start_date") ?? "",
    end_date: str(formData, "end_date") ?? "",
    reason: str(formData, "reason"),
  };
}

export function scheduleExceptionValuesFromFormData(formData: FormData) {
  return {
    doctor_id: str(formData, "doctor_id") ?? "",
    exception_date: str(formData, "exception_date") ?? "",
    start_time: str(formData, "start_time") ?? "",
    end_time: str(formData, "end_time") ?? "",
    reason: str(formData, "reason"),
  };
}
