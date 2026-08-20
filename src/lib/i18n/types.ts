export type Locale = "en" | "ar";

/**
 * Localization foundation, v1. Deliberately a plain typed object tree (not
 * an ICU/message-format library) — the app only needs simple label lookups
 * for the strings this batch touches, and this keeps every consumer
 * type-checked and autocompletable with zero runtime parsing cost. Grow this
 * shape as more of the app is migrated; `en.ts`/`ar.ts` must both satisfy it
 * exactly, so a missing translation is a compile error, not a silent
 * fallback to English at runtime.
 */
export interface Dictionary {
  nav: {
    dashboard: string;
    patients: string;
    doctors: string;
    procedures: string;
    appointments: string;
    reception: string;
    recalls: string;
    billing: string;
    compensation: string;
    inventory: string;
    reports: string;
    settings: string;
    notifications: string;
    sectionOverview: string;
    sectionClinical: string;
    sectionBusiness: string;
    sectionInsights: string;
    sectionSystem: string;
    collapse: string;
    expandSidebar: string;
    collapseSidebar: string;
    openNav: string;
  };
  theme: {
    label: string;
    light: string;
    dark: string;
    system: string;
  };
  locale: {
    label: string;
    english: string;
    arabic: string;
  };
  patientProfile: {
    breadcrumbPatients: string;
    tabs: {
      overview: string;
      dentalChart: string;
      treatmentPlans: string;
      proceduresPerformed: string;
      clinicalNotes: string;
      recalls: string;
      timeline: string;
      appointments: string;
      billing: string;
      files: string;
    };
    overview: {
      personal: string;
      insuranceReferral: string;
      medicalHistory: string;
      dentalHistory: string;
      dateOfBirth: string;
      address: string;
      nationalId: string;
      occupation: string;
      emergencyContact: string;
      referralSource: string;
      insuranceProvider: string;
      insurancePolicyNumber: string;
      allergies: string;
      currentMedications: string;
      medicalConditions: string;
      medicalFlags: string;
      notes: string;
      noAdditionalNotes: string;
      noneRecorded: string;
      noMedicalHistory: string;
      chiefComplaint: string;
      preferredDentist: string;
      dentalHistoryNotes: string;
      flagYes: string;
      flagNo: string;
    };
    summaryRail: {
      lastVisit: string;
      noVisitsYet: string;
      nextAppointment: string;
      noneScheduled: string;
      nextRecall: string;
      noneDue: string;
      overdueSuffix: string;
      activeTreatment: string;
      noActiveTreatment: string;
      outstandingBalance: string;
      medicalAlerts: string;
      none: string;
      activeSuffix: string;
    };
    billingSection: {
      invoices: string;
      payments: string;
      noInvoicesYet: string;
    };
    appointmentsEmpty: string;
    auditTrailHeading: string;
    actions: {
      edit: string;
      archive: string;
      restore: string;
      delete: string;
      cancel: string;
      deletePatientTitle: string;
      deletePatientDescription: string;
      deletePatientConfirm: string;
    };
  };
}
