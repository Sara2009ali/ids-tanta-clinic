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
    doctorSchedule: string;
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
  dentalChart: {
    toothStatus: {
      present: string;
      missing: string;
      unerupted: string;
    };
    toothCondition: {
      caries: string;
      filling: string;
      crown: string;
      root_canal: string;
      watch: string;
      other: string;
    };
    presentNoCondition: string;
    /** "{count}" is replaced with the actual number — exactly-1 vs 2-or-more, not full CLDR plural rules (matches the simplified counting already used elsewhere in this dictionary, e.g. patientProfile.summaryRail.activeSuffix). */
    needsAttentionSingular: string;
    needsAttentionPlural: string;
    noAttentionNeeded: string;
    legend: {
      caries: string;
      watch: string;
      existingWork: string;
      missing: string;
      planned: string;
    };
    dentitionToggleLabel: string;
    dentition: {
      permanent: string;
      primary: string;
    };
    /** Each value already reads as a full "<Upper/Lower> arch" label — used both as the odontogram row's aria-label and (combined with `dentition`) the Tooth Sheet's subtitle. */
    arch: {
      upper: string;
      lower: string;
    };
    universalPrefix: string;
    palmerPrefix: string;
    toothAriaPrefix: string;
    treatmentPlannedSuffix: string;
    sheet: {
      loading: string;
      currentState: string;
      edit: string;
      cancel: string;
      save: string;
      markMissing: string;
      noConditionHealthy: string;
      notesPlaceholder: string;
      plannedTreatment: string;
      nothingPlanned: string;
      performedTreatment: string;
      nothingPerformed: string;
      history: string;
      addObservation: string;
      observationPlaceholder: string;
      noHistory: string;
      linkedToVisit: string;
      doctorPrefix: string;
    };
    toast: {
      updated: string;
      markedMissing: string;
      observationAdded: string;
    };
    events: {
      observationFallback: string;
      healthy: string;
      stateUpdated: string;
      /** Contains the literal substring "{status}" — see describeToothEvent in lib/dental-chart/calculations.ts. */
      markedStatusTemplate: string;
      conditionChangeConnector: string;
    };
    select: {
      noSpecificTooth: string;
      permanentGroup: string;
      primaryGroup: string;
    };
  };
  settings: {
    title: string;
    subtitle: string;
    doctorsCardTitle: string;
    doctorsCardDescription: string;
    manageDoctors: string;
    preferencesCardTitle: string;
    preferencesCardDescription: string;
    managePreferences: string;
    preferencesMenuItem: string;
    preferences: {
      pageTitle: string;
      pageDescription: string;
      themeSectionTitle: string;
      languageSectionTitle: string;
      languageSectionDescription: string;
    };
  };
  doctorSchedule: {
    pageTitle: string;
    pageDescription: string;
    doctorSelectLabel: string;
    noDoctors: string;
    viewDay: string;
    viewWeek: string;
    today: string;
    previous: string;
    next: string;
    workingHoursLabel: string;
    offToday: string;
    onVacation: string;
    defaultHoursNotice: string;
    noAppointmentsDay: string;
    /** Short form for the narrow week-grid cell — the fuller `noAppointmentsDay` sentence doesn't fit there. */
    noAppointmentsShort: string;
    workingDay: string;
    offDay: string;
    editWorkingHours: string;
  };
}
