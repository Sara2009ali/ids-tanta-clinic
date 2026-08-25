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
      priceList: string;
      defaultPriceList: string;
      insurancePlan: string;
      insuranceMemberId: string;
      insuranceGroupNumber: string;
      insuranceCoverage: string;
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
      recentActivity: string;
      viewAllProcedures: string;
      doctorPrefix: string;
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
    proceduresEmpty: string;
    clinicalNotesEmpty: string;
    unnamedPatient: string;
    auditTrailHeading: string;
    files: {
      profilePhoto: string;
      documents: string;
      xrays: string;
      consentForms: string;
    };
    errorState: {
      title: string;
      description: string;
      backToPatients: string;
      tryAgain: string;
    };
    actions: {
      edit: string;
      archive: string;
      restore: string;
      delete: string;
      cancel: string;
      deletePatientTitle: string;
      deletePatientDescription: string;
      deletePatientConfirm: string;
      patientDeleted: string;
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
    clinicCardTitle: string;
    clinicCardDescription: string;
    manageClinic: string;
    doctorsCardTitle: string;
    doctorsCardDescription: string;
    manageDoctors: string;
    staffCardTitle: string;
    staffCardDescription: string;
    manageStaff: string;
    priceListsCardTitle: string;
    priceListsCardDescription: string;
    managePriceLists: string;
    insuranceCardTitle: string;
    insuranceCardDescription: string;
    manageInsurance: string;
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
  priceLists: {
    pageTitle: string;
    pageDescription: string;
    backToProcedures: string;
    nameColumn: string;
    pricingColumn: string;
    actionsColumn: string;
    newPriceListPlaceholder: string;
    addPriceList: string;
    defaultBadge: string;
    disabledBadge: string;
    /** "{count}" replaced with the actual number of custom prices in this list. */
    itemsCountLabel: string;
    itemsCountEmpty: string;
    editPrices: string;
    rename: string;
    save: string;
    disable: string;
    enable: string;
    delete: string;
    cancel: string;
    deleteConfirmTitle: string;
    deleteConfirmDescription: string;
    noPriceLists: string;
    detail: {
      backToPriceLists: string;
      defaultListNotice: string;
      editorHint: string;
      searchPlaceholder: string;
      noSearchResults: string;
      customBadge: string;
      serviceColumn: string;
      normalPriceColumn: string;
      thisListColumn: string;
      overridePlaceholder: string;
      usingNormalPrice: string;
      resetToNormal: string;
    };
  };
  insurance: {
    pageTitle: string;
    pageDescription: string;
    insurersHeading: string;
    newInsurerPlaceholder: string;
    addInsurer: string;
    noInsurers: string;
    plansHeading: string;
    newPlanNamePlaceholder: string;
    coverageLabel: string;
    addPlan: string;
    disable: string;
    enable: string;
    delete: string;
    cancel: string;
    noPlans: string;
    deleteInsurerConfirmTitle: string;
    deleteInsurerConfirmDescription: string;
    deletePlanConfirmTitle: string;
    deletePlanConfirmDescription: string;
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
  appointments: {
    pageTitle: string;
    viewDay: string;
    viewWeek: string;
    viewMonth: string;
    today: string;
    previous: string;
    next: string;
    doctorSchedulesLink: string;
    chairsLink: string;
    newAppointment: string;
    editAppointment: string;
    bookPatientDescription: string;
    updateAppointmentDescription: string;
    noAppointmentsDay: string;
    /** Short form for the narrow week-grid cell — the fuller `noAppointmentsDay` sentence doesn't fit there. */
    noAppointmentsShort: string;
    doctorPrefix: string;
    emergencyBadge: string;
    urgentBadge: string;
    highPriorityBadge: string;
    weekdays: {
      sun: string;
      mon: string;
      tue: string;
      wed: string;
      thu: string;
      fri: string;
      sat: string;
    };
    form: {
      patientLabel: string;
      doctorLabel: string;
      chairLabel: string;
      chairUnassigned: string;
      visitTypeLabel: string;
      visitTypePlaceholder: string;
      visitTypeEmpty: string;
      dateLabel: string;
      timeLabel: string;
      durationLabel: string;
      /** "Ends at {time}" — {time} is substituted by the caller. */
      endsAtLabel: string;
      priorityLabel: string;
      priorityNormal: string;
      priorityHigh: string;
      priorityUrgent: string;
      emergencyLabel: string;
      chiefComplaintLabel: string;
      notesLabel: string;
      cancel: string;
      createSubmit: string;
      saveSubmit: string;
      createdToast: string;
      updatedToast: string;
      detailsTab: string;
      treatmentTab: string;
      checkInToRecordTreatment: string;
    };
    actions: {
      checkIn: string;
      completeVisit: string;
      edit: string;
      viewInvoice: string;
      createInvoice: string;
      cancel: string;
      /** "Actions for {name}" — {name} is substituted by the caller. */
      actionsFor: string;
      /** "{name} checked in" — {name} is substituted by the caller. */
      checkedInToast: string;
      completedToast: string;
      cancelledToast: string;
      cancelConfirmTitle: string;
      /** "{name}'s {time} appointment will be marked cancelled. You can reverse this by editing the appointment again." */
      cancelConfirmDescription: string;
      keepIt: string;
      cancelAppointmentConfirm: string;
    };
    patientPicker: {
      searchPlaceholder: string;
      searching: string;
      noResults: string;
      newPatient: string;
      firstNamePlaceholder: string;
      lastNamePlaceholder: string;
      phonePlaceholder: string;
      createPatient: string;
      cancel: string;
      clearSelected: string;
      createdToast: string;
    };
    quickSearch: {
      placeholder: string;
      searching: string;
      noResults: string;
    };
  };
  onboarding: {
    signup: {
      pageTitle: string;
      pageSubtitle: string;
      clinicNameLabel: string;
      clinicNamePlaceholder: string;
      addressLabel: string;
      addressPlaceholder: string;
      timezoneLabel: string;
      fullNameLabel: string;
      fullNamePlaceholder: string;
      emailLabel: string;
      emailPlaceholder: string;
      passwordLabel: string;
      confirmPasswordLabel: string;
      submit: string;
      haveAccount: string;
      signIn: string;
      newClinicQuestion: string;
      newClinicCta: string;
    };
    activate: {
      pageTitle: string;
      pageSubtitle: string;
      passwordLabel: string;
      confirmPasswordLabel: string;
      submit: string;
      checking: string;
      invalidLink: string;
      passwordTooShort: string;
      passwordsDontMatch: string;
      genericError: string;
    };
  };
  staff: {
    title: string;
    subtitle: string;
    addStaff: string;
    nameColumn: string;
    roleColumn: string;
    statusColumn: string;
    statusPending: string;
    statusActive: string;
    statusInactive: string;
    resendInvite: string;
    deactivate: string;
    reactivate: string;
    noStaffTitle: string;
    noStaffDescription: string;
    form: {
      title: string;
      description: string;
      fullNameLabel: string;
      fullNamePlaceholder: string;
      emailLabel: string;
      emailPlaceholder: string;
      phoneLabel: string;
      roleLabel: string;
      rolePlaceholder: string;
      submit: string;
      cancel: string;
      invitedToast: string;
    };
    roles: {
      super_admin: string;
      admin: string;
      doctor: string;
      assistant: string;
      reception: string;
      accounting: string;
    };
  };
  clinic: {
    pageTitle: string;
    pageSubtitle: string;
    identitySectionTitle: string;
    identitySectionDescription: string;
    regionalSectionTitle: string;
    regionalSectionDescription: string;
    nameLabel: string;
    namePlaceholder: string;
    phoneLabel: string;
    addressLabel: string;
    timezoneLabel: string;
    logoLabel: string;
    logoDescription: string;
    noLogo: string;
    uploadLogo: string;
    replaceLogo: string;
    removeLogo: string;
    save: string;
    savedToast: string;
    invalidLogoType: string;
    logoTooLarge: string;
    logoUploadFailed: string;
    logoRemovedToast: string;
  };
  doctors: {
    accountAccessNote: string;
    deactivatedToast: string;
    reactivatedToast: string;
  };
  reception: {
    pageTitle: string;
    pageDescription: string;
    todaySectionTitle: string;
    statTodayAppointments: string;
    statCheckedIn: string;
    statRemainingToday: string;
    statAvailableChairs: string;
    todaysScheduleTitle: string;
    recentActivityTitle: string;
    filters: {
      all: string;
      upcoming: string;
      completed: string;
      cancelled: string;
      noShow: string;
    };
    filteredEmptyMessage: string;
    recentActivityEmptyTitle: string;
    recentActivityEmptyDescription: string;
    activityCreated: string;
    justNow: string;
    minuteAgo: string;
    minutesAgo: string;
    hourAgo: string;
    hoursAgo: string;
    dayAgo: string;
    daysAgo: string;
  };
}
