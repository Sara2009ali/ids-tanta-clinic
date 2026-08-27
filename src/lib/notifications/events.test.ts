import { describe, it, expect } from "vitest";
import {
  buildRecallCreatedNotification,
  buildStaffInvitedNotification,
  buildAppointmentReminderNotification,
  buildLowStockNotification,
  shouldNotifyForAutoRecall,
  type RecallNotificationInput,
  type StaffInvitedNotificationInput,
  type AppointmentReminderNotificationInput,
  type LowStockNotificationInput,
} from "@/lib/notifications/events";

describe("buildRecallCreatedNotification", () => {
  const input: RecallNotificationInput = {
    clinicId: "clinic-1",
    recallId: "recall-1",
    procedureName: "Dental Cleaning",
    dueDate: "2026-07-01",
    createdBy: "staff-1",
    recipientStaffIds: ["staff-2", "staff-3"],
  };

  it("uses the recalls.auto_created source and info/normal severity", () => {
    const result = buildRecallCreatedNotification(input);
    expect(result.source).toBe("recalls.auto_created");
    expect(result.type).toBe("info");
    expect(result.priority).toBe("normal");
  });

  it("links entity_id/action_url to the recall itself", () => {
    const result = buildRecallCreatedNotification(input);
    expect(result.entityType).toBe("recall");
    expect(result.entityId).toBe("recall-1");
    expect(result.actionUrl).toBe("/recalls");
  });

  it("mentions the procedure and due date in the body", () => {
    const result = buildRecallCreatedNotification(input);
    expect(result.body).toContain("Dental Cleaning");
    expect(result.body).toContain("2026-07-01");
  });

  it("passes the resolved recipients through unchanged", () => {
    const result = buildRecallCreatedNotification(input);
    expect(result.recipientStaffIds).toEqual(["staff-2", "staff-3"]);
  });
});

describe("shouldNotifyForAutoRecall — idempotent notification decision", () => {
  it("notifies when a new recall id was returned (a real insert happened)", () => {
    expect(shouldNotifyForAutoRecall("recall-1")).toBe(true);
  });

  it("does not notify when null was returned (on-conflict-do-nothing — a retry)", () => {
    expect(shouldNotifyForAutoRecall(null)).toBe(false);
  });

  it("does not notify when undefined was returned", () => {
    expect(shouldNotifyForAutoRecall(undefined)).toBe(false);
  });
});

describe("buildStaffInvitedNotification", () => {
  const input: StaffInvitedNotificationInput = {
    clinicId: "clinic-1",
    staffId: "staff-99",
    fullName: "Mona Adel",
    role: "reception",
    createdBy: "staff-1",
    recipientStaffIds: ["staff-1", "staff-4"],
  };

  it("uses the staff.invited source and info/low severity", () => {
    const result = buildStaffInvitedNotification(input);
    expect(result.source).toBe("staff.invited");
    expect(result.type).toBe("info");
    expect(result.priority).toBe("low");
  });

  it("links entity_id/action_url to the staff settings page", () => {
    const result = buildStaffInvitedNotification(input);
    expect(result.entityType).toBe("staff");
    expect(result.entityId).toBe("staff-99");
    expect(result.actionUrl).toBe("/settings/staff");
  });

  it("mentions the invitee's name and role in the body", () => {
    const result = buildStaffInvitedNotification(input);
    expect(result.body).toContain("Mona Adel");
    expect(result.body).toContain("reception");
  });

  it("never includes an email address, invite link, or token anywhere in the payload", () => {
    const result = buildStaffInvitedNotification(input);
    const serialized = JSON.stringify(result).toLowerCase();
    expect(serialized).not.toContain("@");
    expect(serialized).not.toContain("password");
    expect(serialized).not.toContain("token");
    expect(serialized).not.toContain("/activate");
  });
});

describe("buildAppointmentReminderNotification", () => {
  const input: AppointmentReminderNotificationInput = {
    clinicId: "clinic-1",
    appointmentId: "appt-1",
    window: "next_day",
    patientName: "Karim Youssef",
    scheduledStartLabel: "Jun 16, 10:00 AM",
    recipientStaffIds: ["staff-1", "staff-2"],
  };

  it("uses the appointments.reminder source and info/normal severity", () => {
    const result = buildAppointmentReminderNotification(input);
    expect(result.source).toBe("appointments.reminder");
    expect(result.type).toBe("info");
    expect(result.priority).toBe("normal");
  });

  it("links entity_id/action_url to the appointment", () => {
    const result = buildAppointmentReminderNotification(input);
    expect(result.entityType).toBe("appointment");
    expect(result.entityId).toBe("appt-1");
    expect(result.actionUrl).toBe("/appointments");
  });

  it("mentions the patient's name and scheduled time in the body", () => {
    const result = buildAppointmentReminderNotification(input);
    expect(result.body).toContain("Karim Youssef");
    expect(result.body).toContain("Jun 16, 10:00 AM");
  });

  it("always sets a database-enforced event key scoped to this appointment and window", () => {
    const result = buildAppointmentReminderNotification(input);
    expect(result.eventKey).toBe("appointment_reminder:appt-1:next_day");
  });

  it("produces a different event key for a different appointment", () => {
    const other = buildAppointmentReminderNotification({ ...input, appointmentId: "appt-2" });
    expect(other.eventKey).not.toBe(buildAppointmentReminderNotification(input).eventKey);
  });
});

describe("buildLowStockNotification", () => {
  const input: LowStockNotificationInput = {
    clinicId: "clinic-1",
    productId: "product-1",
    productName: "Latex Gloves (M)",
    stockLevel: 4,
    reorderThreshold: 10,
    recipientStaffIds: ["staff-1"],
  };

  it("uses the inventory.low_stock source and warning/normal severity", () => {
    const result = buildLowStockNotification(input);
    expect(result.source).toBe("inventory.low_stock");
    expect(result.type).toBe("warning");
    expect(result.priority).toBe("normal");
  });

  it("links entity_id/action_url to the product", () => {
    const result = buildLowStockNotification(input);
    expect(result.entityType).toBe("inventory_product");
    expect(result.entityId).toBe("product-1");
    expect(result.actionUrl).toBe("/inventory/products");
  });

  it("mentions the product name, stock level, and threshold in the body", () => {
    const result = buildLowStockNotification(input);
    expect(result.body).toContain("Latex Gloves (M)");
    expect(result.body).toContain("4");
    expect(result.body).toContain("10");
  });

  it("does not set an event key — deduplication is handled by the low-stock state table, not a point-in-time key", () => {
    const result = buildLowStockNotification(input);
    expect(result.eventKey).toBeUndefined();
  });
});
