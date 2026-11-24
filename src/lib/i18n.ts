import type { LabMode, LabSubject, Locale } from "./types";

export interface LocalizedStrings {
  brandName: string;
  nav: {
    laboratories: string;
    forTeachers: string;
    help: string;
    signIn: string;
    signOut: string;
    dashboard: string;
    assignments: string;
    results: string;
    classes: string;
    reports: string;
    library: string;
    exitLab: string;
    admin: string;
    content: string;
  };
  home: {
    eyebrow: string;
    heroPrefix: string;
    heroAnd: string;
    heroSubtitle: string;
    exploreLabsCta: string;
    exploreAction: string;
    simModeTitle: string;
    simModeDesc: string;
    expModeTitle: string;
    expModeDesc: string;
    explorePracticalHeading: string;
    browseAll: string;
    viewPractical: string;
    footerLeft: string;
    footerRight: string;
  };
  subjects: Record<LabSubject, { name: string; shortDesc: string; hubSubtitle: string }>;
  catalogue: {
    eyebrow: string;
    heading: string;
    subtitle: string;
    searchPlaceholder: string;
    subjectLabel: string;
    classLabel: string;
    all: string;
    availableHeading: string;
    statusNote: string;
    viewExperiment: string;
    resetFilters: string;
    emptyTitle: string;
    emptyDesc: string;
    classPrefix: string;
    curriculumReview: string;
  };
  detail: {
    chooseModeHeading: string;
    simTitle: string;
    simDesc: string;
    simCta: string;
    expTitle: string;
    expDesc: string;
    expCta: string;
    objectiveHeading: string;
    apparatusHeading: string;
    safetyHeading: string;
    scopeNotice: string;
    reviewLocked: string;
    editionPendingBadge: string;
    provenanceToggle: string;
  };
  student: {
    workspaceEyebrow: string;
    sidebarHeading: string;
    welcomeHeading: string;
    welcomeSub: string;
    continueTagSim: string;
    continueTagExp: string;
    resumeCta: string;
    upcomingHeading: string;
    viewAllAssignments: string;
    progressHeading: string;
    progressSub: string;
    resultsHeading: string;
    syntheticNotice: string;
    notStarted: string;
    inProgress: string;
    submitted: string;
    viewAction: string;
  };
  teacher: {
    workspaceEyebrow: string;
    sidebarHeading: string;
    subtitle: string;
    assignCta: string;
    enrolledLearners: string;
    assignedPracticals: string;
    submissionsCount: string;
    assignmentsHeading: string;
    assignmentsSub: string;
    evidenceReportsHeading: string;
    evidenceReportsDesc: string;
    openClassReport: string;
    syntheticNotice: string;
    exportCsv: string;
  };
  player: {
    simBadge: string;
    expBadge: string;
    savedAtRevision: string;
    currentStep: string;
    observationNotebook: string;
    evidence: string;
    safety: string;
    resetView: string;
    equipmentList: string;
    accessibleDomMode: string;
    canvasViewMode: string;
    previousStep: string;
    nextCheck: string;
    submitPractical: string;
    inquirySetup: string;
    evidenceComparisons: string;
    theoryOnlyResults: string;
    runCalculation: string;
    recordComparison: string;
    backToDetail: string;
    provenanceFooter: string;
    illustrativeView: string;
    offlinePending: string;
    noObservationYet: string;
  };
  common: {
    simulation: string;
    experiment: string;
    loading: string;
    classWord: string;
  };
}

const EN_IN: LocalizedStrings = {
  brandName: "G1 Virtual Labs",
  nav: {
    laboratories: "Laboratories",
    forTeachers: "For teachers",
    help: "Help",
    signIn: "Sign in",
    signOut: "Sign out",
    dashboard: "Dashboard",
    assignments: "Assignments",
    results: "Results",
    classes: "Classes",
    reports: "Reports",
    library: "Library",
    exitLab: "Exit lab",
    admin: "Administration",
    content: "Content review",
  },
  home: {
    eyebrow: "G1 VIRTUAL LABS / EXPLORE · EXPERIMENT · LEARN",
    heroPrefix: "Explore science in",
    heroAnd: "and",
    heroSubtitle:
      "Premium interactive science learning for Classes 6–10 and Intermediate 1st & 2nd Year in Andhra Pradesh. Explore concepts, test ideas and record confirmed learning evidence.",
    exploreLabsCta: "Explore laboratories",
    exploreAction: "Explore subject",
    simModeTitle: "Simulation Mode",
    simModeDesc: "Guided concept steps, interactive apparatus and server-confirmed observations.",
    expModeTitle: "Experiment Mode",
    expModeDesc: "Change supported variables, compare trials and explain scientific evidence.",
    explorePracticalHeading: "Available practicals",
    browseAll: "See all experiments",
    viewPractical: "View practical",
    footerLeft: "G1 Virtual Labs · English / తెలుగు",
    footerRight: "Andhra Pradesh School & Intermediate Science · Original learning platform",
  },
  subjects: {
    chemistry: {
      name: "Chemistry",
      shortDesc: "Materials, reactions and matter.",
      hubSubtitle:
        "Andhra Pradesh Chemistry practicals with bounded virtual stoichiometry and safety controls.",
    },
    physics: {
      name: "Physics",
      shortDesc: "Light, motion and energy.",
      hubSubtitle:
        "Andhra Pradesh Physics practicals covering optics, measurements and analytic geometry.",
    },
    biology: {
      name: "Biology",
      shortDesc: "Cells, plants and life systems.",
      hubSubtitle:
        "Andhra Pradesh Biology practicals built on microscopy observation and documented specimen views.",
    },
  },
  catalogue: {
    eyebrow: "EXPLORE LABORATORIES",
    heading: "Your next discovery starts here.",
    subtitle:
      "Search by concept, filter across all 7 education stages (Classes 6–10 & Intermediate 1st/2nd Year) and subjects, and explore published or review-pending activities.",
    searchPlaceholder: "Search experiment, chapter or scientific concept",
    subjectLabel: "Subject",
    classLabel: "Class",
    all: "All",
    availableHeading: "Explore available and upcoming practicals",
    statusNote: "3 locally launchable neutral activities · 3 review-pending previews",
    viewExperiment: "View experiment",
    resetFilters: "Reset filters",
    emptyTitle: "No matching practicals found",
    emptyDesc:
      "Try clearing a filter or switching to Class 10, Class 9 or Class 8 to inspect currently catalogued practicals.",
    classPrefix: "Class",
    curriculumReview: "Curriculum review",
  },
  detail: {
    chooseModeHeading: "Choose your learning mode",
    simTitle: "Simulation Mode",
    simDesc: "Guided practical with steps, hints, validated observations and checkpoints.",
    simCta: "Start guided practical",
    expTitle: "Experiment Mode",
    expDesc: "Set an inquiry question, vary supported conditions and compare evidence.",
    expCta: "Start investigation",
    objectiveHeading: "Learning objective",
    apparatusHeading: "Apparatus",
    safetyHeading: "Safety and scope",
    scopeNotice:
      "Apparatus and measurements will be finalized against the approved Andhra Pradesh textbook and subject review.",
    reviewLocked:
      "Under curriculum & model review — student launch enabled after independent two-person approval.",
    editionPendingBadge: "Textbook edition under review",
    provenanceToggle: "Manifest, model scope & accessibility parity",
  },
  student: {
    workspaceEyebrow: "YOUR PERSONAL SCIENCE LAB",
    sidebarHeading: "Student workspace",
    welcomeHeading: "Pick up where you left off.",
    welcomeSub: "Your experiments, saved work and confirmed learning evidence in one space.",
    continueTagSim: "CHEMISTRY · CLASS 10 · SIMULATION MODE",
    continueTagExp: "EXPERIMENT MODE · BOUNDED INQUIRY",
    resumeCta: "Resume lab",
    upcomingHeading: "My assignments",
    viewAllAssignments: "View all assignments",
    progressHeading: "My progress",
    progressSub: "Based on server-confirmed activities across subjects",
    resultsHeading: "My results & evidence",
    syntheticNotice:
      "Local workspace uses synthetic test roster and fixture data; no real student information.",
    notStarted: "Not started",
    inProgress: "In progress",
    submitted: "Submitted",
    viewAction: "Open",
  },
  teacher: {
    workspaceEyebrow: "YOUR TEACHING SPACE",
    sidebarHeading: "Teacher workspace",
    subtitle: "Manage assignments, inspect confirmed evidence and support learners.",
    assignCta: "+ Assign experiment",
    enrolledLearners: "Enrolled learners",
    assignedPracticals: "Assignments",
    submissionsCount: "Submissions",
    assignmentsHeading: "Assignments & student evidence",
    assignmentsSub: "Open an assignment to inspect attempt evidence and rubric results.",
    evidenceReportsHeading: "Evidence-based reports",
    evidenceReportsDesc:
      "Scores are linked to actual submitted checkpoints, rubrics and content versions—not animation or time spent.",
    openClassReport: "Open report & evidence",
    syntheticNotice:
      "Local workspace uses synthetic teacher accounts and test roster; no real student information.",
    exportCsv: "Export audited CSV",
  },
  player: {
    simBadge: "Simulation Mode · Guided",
    expBadge: "Experiment Mode · Independent inquiry",
    savedAtRevision: "Saved at confirmed revision",
    currentStep: "YOUR CURRENT STEP",
    observationNotebook: "OBSERVATION NOTEBOOK",
    evidence: "Evidence",
    safety: "SAFETY & SCOPE",
    resetView: "Reset view",
    equipmentList: "Equipment list",
    accessibleDomMode: "Accessible controls",
    canvasViewMode: "Interactive canvas",
    previousStep: "Previous step",
    nextCheck: "Check and continue",
    submitPractical: "Submit practical",
    inquirySetup: "INQUIRY SETUP",
    evidenceComparisons: "EVIDENCE & COMPARISONS",
    theoryOnlyResults: "Theory-only results",
    runCalculation: "Run supported calculation",
    recordComparison: "Record comparison",
    backToDetail: "Back to experiment detail",
    provenanceFooter: "Variables, limits and provenance remain visible in the inquiry record.",
    illustrativeView: "ILLUSTRATIVE APPARATUS · NOT TO SCALE",
    offlinePending: "Offline — pending server sync (grades never finalize offline)",
    noObservationYet:
      "Confirmed observations will appear here after you complete a validated laboratory action.",
  },
  common: {
    simulation: "Simulation Mode",
    experiment: "Experiment Mode",
    loading: "Loading...",
    classWord: "Class",
  },
};

const TE_IN: LocalizedStrings = {
  brandName: "G1 Virtual Labs",
  nav: {
    laboratories: "ప్రయోగశాలలు",
    forTeachers: "ఉపాధ్యాయులకు",
    help: "సహాయం",
    signIn: "సైన్ ఇన్",
    signOut: "సైన్ అవుట్",
    dashboard: "డాష్‌బోర్డ్",
    assignments: "అసైన్‌మెంట్లు",
    results: "ఫలితాలు",
    classes: "తరగతులు",
    reports: "నివేదికలు",
    library: "ప్రయోగ గ్రంథాలయం",
    exitLab: "ల్యాబ్ నుండి నిష్క్రమించు",
    admin: "నిర్వహణ",
    content: "కంటెంట్ సమీక్ష",
  },
  home: {
    eyebrow: "G1 VIRTUAL LABS / అన్వేషణ · ప్రయోగం · అభ్యాసం",
    heroPrefix: "సైన్స్‌ను అన్వేషించండి:",
    heroAnd: "మరియు",
    heroSubtitle:
      "ఆంధ్రప్రదేశ్ 6–10 తరగతులు మరియు ఇంటర్మీడియట్ 1వ & 2వ సంవత్సరం విద్యార్థులు, ఉపాధ్యాయుల కోసం ఇంటరాక్టివ్ వర్చువల్ సైన్స్ ప్రయోగశాలలు.",
    exploreLabsCta: "ప్రయోగశాలలను అన్వేషించండి",
    exploreAction: "సబ్జెక్ట్ తెరవండి",
    simModeTitle: "సిమ్యులేషన్ మోడ్",
    simModeDesc: "మార్గదర్శక దశలను అనుసరించండి, ఇంటరాక్టివ్ పరికరాలతో పరిశీలనలను నమోదు చేయండి.",
    expModeTitle: "ఎక్స్‌పెరిమెంట్ మోడ్",
    expModeDesc: "ఆమోదించిన చరరాశులను మార్చండి, ట్రయల్స్‌ను పోల్చండి మరియు శాస్త్రీయ ఆధారాలను వివరించండి.",
    explorePracticalHeading: "అందుబాటులో ఉన్న ప్రయోగాలు",
    browseAll: "అన్ని ప్రయోగాలను చూడండి",
    viewPractical: "ప్రయోగాన్ని చూడండి",
    footerLeft: "G1 Virtual Labs · English / తెలుగు",
    footerRight: "ఆంధ్రప్రదేశ్ పాఠశాల & ఇంటర్మీడియట్ సైన్స్ · స్వతంత్ర అభ్యాస వేదిక",
  },
  subjects: {
    chemistry: {
      name: "రసాయన శాస్త్రం",
      shortDesc: "పదార్థాలు, రసాయన చర్యలు మరియు ద్రావణాలు.",
      hubSubtitle:
        "ఆంధ్రప్రదేశ్ పాఠ్యపుస్తక ఆధారిత రసాయన శాస్త్ర ప్రయోగాలు మరియు సురక్షిత పరిమిత నమూనాలు.",
    },
    physics: {
      name: "భౌతిక శాస్త్రం",
      shortDesc: "కాంతి, చలనం, బలాలు మరియు శక్తి.",
      hubSubtitle: "కాంతి వక్రీభవనం, కొలతలు మరియు భౌతిక సూత్రాల ఆధారిత వర్చువల్ ప్రయోగాలు.",
    },
    biology: {
      name: "జీవ శాస్త్రం",
      shortDesc: "కణాలు, మొక్కలు మరియు జీవ వ్యవస్థలు.",
      hubSubtitle:
        "సూక్ష్మదర్శిని పరిశీలన మరియు ఆమోదించిన నమూనా చిత్రాలతో జీవ శాస్త్ర ప్రయోగాలు.",
    },
  },
  catalogue: {
    eyebrow: "ప్రయోగశాలలను అన్వేషించండి",
    heading: "మీ తదుపరి శాస్త్రీయ ఆవిష్కరణ ఇక్కడే మొదలవుతుంది.",
    subtitle:
      "అంశం ద్వారా శోధించండి, మొత్తం 7 విద్యా స్థాయిలు (6–10 తరగతులు & ఇంటర్ 1వ/2వ సం.) మరియు సబ్జెక్టుల వారీగా ఫిల్టర్ చేయండి.",
    searchPlaceholder: "ప్రయోగం, అధ్యాయం లేదా శాస్త్రీయ అంశం ద్వారా శోధించండి",
    subjectLabel: "సబ్జెక్ట్",
    classLabel: "తరగతి",
    all: "అన్నీ",
    availableHeading: "అందుబాటులో ఉన్న మరియు సమీక్షలో ఉన్న ప్రయోగాలు",
    statusNote: "3 ప్రారంభించగల తటస్థ ప్రయోగాలు · 3 సమీక్ష-పెండింగ్ ప్రివ్యూలు",
    viewExperiment: "ప్రయోగాన్ని చూడండి",
    resetFilters: "ఫిల్టర్లను క్లియర్ చేయండి",
    emptyTitle: "సరిపోయే ప్రయోగాలు కనబడలేదు",
    emptyDesc:
      "ఫిల్టర్లను తొలగించి లేదా ప్రస్తుతం ప్రయోగాలు ఉన్న 10వ, 9వ లేదా 8వ తరగతిని ఎంచుకుని మళ్ళీ ప్రయత్నించండి.",
    classPrefix: "తరగతి",
    curriculumReview: "పాఠ్యాంశ సమీక్ష",
  },
  detail: {
    chooseModeHeading: "మీ అభ్యాస మోడ్‌ను ఎంచుకోండి",
    simTitle: "సిమ్యులేషన్ మోడ్",
    simDesc: "దశలవారీ మార్గదర్శనం, సూచనలు, ధృవీకరించిన పరిశీలనలు మరియు చెక్‌పాయింట్లు.",
    simCta: "మార్గదర్శక ప్రయోగం ప్రారంభించు",
    expTitle: "ఎక్స్‌పెరిమెంట్ మోడ్",
    expDesc: "పరిశోధనా ప్రశ్నను ఎంచుకుని, ఆమోదించిన చరరాశులను మార్చి ఆధారాలను పోల్చండి.",
    expCta: "స్వతంత్ర పరిశోధన ప్రారంభించు",
    objectiveHeading: "అభ్యాస లక్ష్యం",
    apparatusHeading: "పరికరాలు",
    safetyHeading: "భద్రత మరియు పరిధి",
    scopeNotice:
      "ఆమోదించిన ఆంధ్రప్రదేశ్ పాఠ్యపుస్తకం మరియు నిపుణుల సమీక్ష ప్రకారం పరికరాలు మరియు కొలతలు ఖరారు చేయబడతాయి.",
    reviewLocked:
      "పాఠ్యాంశ మరియు నమూనా సమీక్షలో ఉంది — ఇద్దరు సమీక్షకుల ఆమోదం తర్వాత ప్రారంభం అందుబాటులోకి వస్తుంది.",
    editionPendingBadge: "పాఠ్యపుస్తక ఎడిషన్ సమీక్షలో ఉంది",
    provenanceToggle: "మానిఫెస్ట్, మోడల్ పరిధి & యాక్సెసిబిలిటీ వివరాలు",
  },
  student: {
    workspaceEyebrow: "మీ వ్యక్తిగత సైన్స్ ల్యాబ్",
    sidebarHeading: "విద్యార్థి వర్క్‌స్పేస్",
    welcomeHeading: "మీరు ఆపిన చోట నుండి కొనసాగించండి.",
    welcomeSub: "మీ ప్రయోగాలు, సేవ్ చేసిన పురోగతి మరియు నిర్ధారించిన అభ్యాస సాక్ష్యాలు ఒకే చోట.",
    continueTagSim: "సిమ్యులేషన్ మోడ్ · మార్గదర్శక అభ్యాసం",
    continueTagExp: "ఎక్స్‌పెరిమెంట్ మోడ్ · శాస్త్రీయ పరిశోధన",
    resumeCta: "ల్యాబ్ కొనసాగించు",
    upcomingHeading: "నా అసైన్‌మెంట్లు",
    viewAllAssignments: "అన్ని అసైన్‌మెంట్లు చూడండి",
    progressHeading: "నా పురోగతి",
    progressSub: "సర్వర్-నిర్ధారించిన ప్రయోగాల ఆధారంగా",
    resultsHeading: "నా ఫలితాలు & సాక్ష్యాలు",
    syntheticNotice: "స్థానిక పరీక్షా డేటా మాత్రమే; నిజమైన విద్యార్థుల వివరాలు లేవు.",
    notStarted: "ప్రారంభించలేదు",
    inProgress: "కొనసాగుతోంది",
    submitted: "సమర్పించబడింది",
    viewAction: "తెరువు",
  },
  teacher: {
    workspaceEyebrow: "మీ బోధనా వేదిక",
    sidebarHeading: "ఉపాధ్యాయ వర్క్‌స్పేస్",
    subtitle: "ప్రయోగాలను కేటాయించండి, నిర్ధారించిన సాక్ష్యాలను తనిఖీ చేయండి మరియు విద్యార్థులకు మద్దతు ఇవ్వండి.",
    assignCta: "+ ప్రయోగం కేటాయించు",
    enrolledLearners: "నమోదైన విద్యార్థులు",
    assignedPracticals: "అసైన్‌మెంట్లు",
    submissionsCount: "సమర్పణలు",
    assignmentsHeading: "అసైన్‌మెంట్లు & విద్యార్థి సాక్ష్యాలు",
    assignmentsSub: "ప్రయత్న ఆధారాలు మరియు రూబ్రిక్ ఫలితాలను చూడటానికి అసైన్‌మెంట్‌ను తెరవండి.",
    evidenceReportsHeading: "ఆధారాల ఆధారిత నివేదికలు",
    evidenceReportsDesc:
      "మార్కులు యానిమేషన్ లేదా సమయంపై కాకుండా ధృవీకరించిన చెక్‌పాయింట్లు, రూబ్రిక్‌లు మరియు కంటెంట్ వెర్షన్‌పై ఆధారపడతాయి.",
    openClassReport: "నివేదిక & సాక్ష్యాలను తెరువు",
    syntheticNotice:
      "స్థానిక పరీక్షా ఉపాధ్యాయ ఖాతాలు మరియు డేటా మాత్రమే; నిజమైన విద్యార్థి సమాచారం లేదు.",
    exportCsv: "ఆడిట్ చేసిన CSV ఎగుమతి",
  },
  player: {
    simBadge: "సిమ్యులేషన్ మోడ్ · మార్గదర్శకం",
    expBadge: "ఎక్స్‌పెరిమెంట్ మోడ్ · స్వతంత్ర పరిశోధన",
    savedAtRevision: "నిర్ధారించిన రివిజన్ వద్ద సేవ్ అయింది",
    currentStep: "ప్రస్తుత దశ",
    observationNotebook: "పరిశీలన నోట్‌బుక్",
    evidence: "ఆధారాలు",
    safety: "భద్రత & పరిధి",
    resetView: "దృశ్యాన్ని రీసెట్ చేయి",
    equipmentList: "పరికరాల జాబితా",
    accessibleDomMode: "యాక్సెసిబుల్ నియంత్రణలు",
    canvasViewMode: "ఇంటరాక్టివ్ కాన్వాస్",
    previousStep: "మునుపటి దశ",
    nextCheck: "తనిఖీ చేసి కొనసాగించు",
    submitPractical: "ప్రయోగాన్ని సమర్పించు",
    inquirySetup: "పరిశోధనా అమరిక",
    evidenceComparisons: "ఆధారాలు & పోలికలు",
    theoryOnlyResults: "సైద్ధాంతిక పరిమితి ఫలితాలు",
    runCalculation: "ఆమోదించిన గణనను అమలు చేయి",
    recordComparison: "పోలికను నమోదు చేయి",
    backToDetail: "ప్రయోగ వివరాలకు తిరిగి వెళ్ళు",
    provenanceFooter: "చరరాశులు, పరిమితులు మరియు మూల వివరాలు పరిశోధనా రికార్డులో కనిపిస్తాయి.",
    illustrativeView: "పరికరాల నమూనా దృశ్యం · కొలతకు కాదు",
    offlinePending: "ఆఫ్‌లైన్ — సర్వర్ సింక్ పెండింగ్‌లో ఉంది",
    noObservationYet: "మీరు ధృవీకరించబడిన చర్యను పూర్తి చేసిన తర్వాత పరిశీలనలు ఇక్కడ కనిపిస్తాయి.",
  },
  common: {
    simulation: "సిమ్యులేషన్ మోడ్",
    experiment: "ఎక్స్‌పెరిమెంట్ మోడ్",
    loading: "లోడ్ అవుతోంది...",
    classWord: "తరగతి",
  },
};

export function getDictionary(locale: Locale): LocalizedStrings {
  return locale === "te-IN" ? TE_IN : EN_IN;
}

export interface ExperimentCopy {
  title: string;
  shortTitle: string;
  subtitle: string;
  activityLabel: string;
  apparatusText: string;
  imagePath: string;
  thumbPath: string;
  mediaQualifier: string;
  modelScopeBadge: string;
  modelLimitNote: string;
  inquiryQuestion: string;
}

export function getExperimentCopy(experimentId: string, locale: Locale, subject?: LabSubject): ExperimentCopy {
  if (experimentId.startsWith("creator-") && subject) {
    const template = { chemistry: "AP-CHEM-10-2.3", biology: "AP-BIO-09-5.1", physics: "AP-PHYS-10-9.10" }[subject];
    return getExperimentCopy(template, locale);
  }
  const isTe = locale === "te-IN";
  switch (experimentId) {
    case "AP-CHEM-10-2.3":
      return {
        title: isTe
          ? "జింక్ మరియు సజల సల్ఫ్యూరిక్ ఆమ్లం చర్య"
          : "Reaction of zinc with dilute sulfuric acid",
        shortTitle: isTe ? "జింక్ మరియు సజల సల్ఫ్యూరిక్ ఆమ్లం" : "Zinc and dilute sulfuric acid",
        subtitle: isTe
          ? "కృత్యం 2.3. వాయువు వెలువడే రసాయన చర్యను పరిశీలించి సబ్బు ద్రావణంలో ఆధారాలను విశ్లేషించండి."
          : "Activity 2.3. Observe evidence of a gas-forming reaction and relate the observation to a supported chemical explanation.",
        activityLabel: isTe ? "కృత్యం 2.3" : "Activity 2.3",
        apparatusText: isTe
          ? "పరీక్ష నాళిక, స్టాండ్, జింక్ ముక్కలు, వాయు వాహక నాళం మరియు సబ్బు ద్రావణ పాత్ర."
          : "Reaction tube, stand, zinc, gas delivery tube and soap-solution receiver.",
        imagePath: "/assets/labs/activity23_concept.svg",
        thumbPath: "/assets/labs/zinc.png",
        mediaQualifier: isTe
          ? "నమూనా చిత్రం · నిజమైన రసాయన కొలత కాదు"
          : "Concept illustration · Not a physical reaction measurement",
        modelScopeBadge: "Model scope: Zn + dilute H₂SO₄",
        modelLimitNote: isTe
          ? "సైద్ధాంతిక గరిష్ట పరిమితి మాత్రమే; నిజమైన వాయు పరిమాణం లేదా వేగం కాదు"
          : "Theoretical upper bounds, not measured gas volume",
        inquiryQuestion: isTe
          ? "చర్యాజనకాల పరిమాణాన్ని మార్చడం వల్ల సైద్ధాంతిక H₂ పరిమితి మారుతుందా?"
          : "Does changing the amount change the theoretical limit?",
      };
    case "AP-PHYS-10-9.10":
      return {
        title: isTe
          ? "సమాంతర గాజు దిమ్మె ద్వారా కాంతి వక్రీభవనం"
          : "Refraction through a parallel glass slab",
        shortTitle: isTe ? "గాజు దిమ్మె వక్రీభవనం" : "Glass slab refraction",
        subtitle: isTe
          ? "కృత్యం 9.10. పతన కిరణం, వక్రీభవన కిరణం మరియు బహిర్గత కిరణాల పార్శ్వ స్థానభ్రంశాన్ని పరిశీలించండి."
          : "Activity 9.10. Trace incident, refracted and emergent rays and interpret lateral displacement.",
        activityLabel: isTe ? "కృత్యం 9.10" : "Activity 9.10",
        apparatusText: isTe
          ? "దీర్ఘచతురస్రాకార గాజు దిమ్మె, కిరణ పట్టిక, కోణమానిని మరియు స్కేలు."
          : "Parallel glass slab, ray card, protractor and millimetre scale.",
        imagePath: "/assets/labs/physics_slab.svg",
        thumbPath: "/assets/labs/refraction.png",
        mediaQualifier: isTe
          ? "దృశా నమూనా చిత్రం · ఆదర్శ స్నెల్ జ్యామితి"
          : "Optics concept render · Ideal Snell analytic model",
        modelScopeBadge: "Model scope: Snell slab (0–60°, 10–30 mm)",
        modelLimitNote: isTe
          ? "ఆదర్శ స్నెల్ గణన (n=1.500); భౌతిక పరికర కాలిబ్రేషన్ పెండింగ్‌లో ఉంది"
          : "Ideal analytic Snell geometry (n=1.500); physical calibration pending",
        inquiryQuestion: isTe
          ? "పతన కోణం లేదా గాజు దిమ్మె మందం మారితే పార్శ్వ స్థానభ్రంశం ఎలా మారుతుంది?"
          : "How do incident angle and slab thickness affect lateral displacement?",
      };
    case "AP-BIO-09-5.1":
      return {
        title: isTe
          ? "సూక్ష్మదర్శిని ద్వారా ఉల్లిపాయ పొర పరిశీలన"
          : "Onion epidermis through a compound microscope",
        shortTitle: isTe ? "ఉల్లిపాయ పొర" : "Onion epidermis",
        subtitle: isTe
          ? "కృత్యం 5.1. ఆమోదించిన స్లైడ్ వీక్షణల ద్వారా వృక్ష కణ కవచాలను మరియు నిర్మాణాలను గుర్తించండి."
          : "Activity 5.1. Inspect acquired slide views, recognize plant cell boundaries and note measurement limits.",
        activityLabel: isTe ? "కృత్యం 5.1" : "Activity 5.1",
        apparatusText: isTe
          ? "సంయుక్త సూక్ష్మదర్శిని, సిద్ధం చేసిన ఉల్లిపాయ పొర స్లైడ్, వీక్షణ ఫీల్డ్ మరియు స్కేల్ ఓవర్‌లే."
          : "Compound microscope, prepared onion slide, discrete field viewer and scale overlay.",
        imagePath: "/assets/labs/onion_microscopy.svg",
        thumbPath: "/assets/labs/onion.png",
        mediaQualifier: isTe
          ? "కణ నిర్మాణ నమూనా చిత్రం · కాలిబ్రేట్ చేసిన మైక్రోగ్రాఫ్ పెండింగ్"
          : "Illustrative specimen study · Calibrated micrograph dataset pending",
        modelScopeBadge: "Model scope: Discrete fixture planes 0–2",
        modelLimitNote: isTe
          ? "నమూనా వీక్షణ మాత్రమే; కాలిబ్రేట్ చేసిన మైక్రోగ్రాఫ్ డేటాసెట్ పెండింగ్‌లో ఉంది"
          : "Qualitative fixture view only; calibrated micrograph dataset pending",
        inquiryQuestion: isTe
          ? "వేర్వేరు ఫీల్డ్‌లు మరియు ఫోకల్ ప్లేన్‌లలో కణ కవచాలు ఎలా కనిపిస్తాయి?"
          : "Which plant cell boundaries remain clearly identifiable across focal planes?",
      };
    case "AP-CHEM-10-2.1":
      return {
        title: isTe ? "ఆమ్ల–క్షార సూచికలు" : "Acid–base indicators",
        shortTitle: isTe ? "ఆమ్ల–క్షార సూచికలు" : "Acid–base indicators",
        subtitle: isTe
          ? "సూచిక రంగు మార్పును విశ్లేషించండి (పాఠ్యాంశ సమీక్షలో ఉంది)."
          : "Interpret an indicator colour change (under curriculum review).",
        activityLabel: isTe ? "కృత్యం 2.1" : "Activity 2.1",
        apparatusText: isTe
          ? "సూచిక నాళికలు, డ్రాపర్ మరియు ఆమోదించిన నమూనా ద్రావణాలు."
          : "Indicator tubes, dropper and approved reference solutions.",
        imagePath: "/assets/labs/indicator_tubes.svg",
        thumbPath: "/assets/labs/chemistry.png",
        mediaQualifier: isTe
          ? "సమీక్ష-పెండింగ్ ప్రివ్యూ · నమూనా చిత్రం"
          : "Review-pending preview · Concept illustration",
        modelScopeBadge: "Review pending",
        modelLimitNote: isTe
          ? "పాఠ్యాంశ మరియు నమూనా ఆమోదం పెండింగ్‌లో ఉంది"
          : "Curriculum and model approval pending",
        inquiryQuestion: isTe
          ? "సూచిక రంగు మార్పు ఆమ్ల–క్షార స్వభావాన్ని ఎలా సూచిస్తుంది?"
          : "How does indicator shift classify aqueous samples?",
      };
    case "AP-PHYS-10-12.1":
      return {
        title: isTe ? "సరళ విద్యుత్ వలయాలు" : "Simple electric circuits",
        shortTitle: isTe ? "సరళ విద్యుత్ వలయాలు" : "Simple electric circuits",
        subtitle: isTe
          ? "సరళ వలయాన్ని నిర్మించి అంచనా వేయండి (సమీక్షలో ఉంది)."
          : "Build and assess a bounded DC circuit (under curriculum review).",
        activityLabel: isTe ? "విద్యుత్ కృత్యం" : "Circuit activity",
        apparatusText: isTe
          ? "బ్యాటరీ, నిరోధకం, స్విచ్ మరియు అమ్మీటర్."
          : "Cell, resistor, switch and ammeter.",
        imagePath: "/assets/labs/electric_circuit.svg",
        thumbPath: "/assets/labs/physics.png",
        mediaQualifier: isTe
          ? "సమీక్ష-పెండింగ్ ప్రివ్యూ · నమూనా చిత్రం"
          : "Review-pending preview · Concept illustration",
        modelScopeBadge: "Review pending",
        modelLimitNote: isTe
          ? "DC వలయ గణన నమూనా సమీక్షలో ఉంది"
          : "DC solver qualification pending",
        inquiryQuestion: isTe
          ? "నిరోధం మారితే విద్యుత్ ప్రవాహం ఎలా మారుతుంది?"
          : "How does resistance change current in a series circuit?",
      };
    default:
      return {
        title: isTe ? "మొక్కల నిర్మాణాలు మరియు పత్రరంధ్రాలు" : "Plant structures and stomata",
        shortTitle: isTe ? "మొక్కల నిర్మాణాలు" : "Plant structures",
        subtitle: isTe
          ? "నమోదించిన మొక్కల కణ ఆధారాలను పోల్చండి (సమీక్షలో ఉంది)."
          : "Compare recorded plant tissue evidence (under curriculum review).",
        activityLabel: isTe ? "కణజాల పరిశీలన" : "Tissue observation",
        apparatusText: isTe
          ? "సూక్ష్మదర్శిని మరియు సిద్ధం చేసిన ఆకు పొర స్లైడ్."
          : "Compound microscope and prepared leaf peel slide.",
        imagePath: "/assets/labs/biology_photo.jpg",
        thumbPath: "/assets/labs/biology.png",
        mediaQualifier: isTe
          ? "సమీక్ష-పెండింగ్ ప్రివ్యూ · నమూనా చిత్రం"
          : "Review-pending preview · Concept illustration",
        modelScopeBadge: "Review pending",
        modelLimitNote: isTe
          ? "ఆమోదించిన మైక్రోగ్రాఫ్ డేటాసెట్ పెండింగ్‌లో ఉంది"
          : "Rights-cleared dataset pending",
        inquiryQuestion: isTe
          ? "రక్షక కణాల ఆకృతి ఎలా మారుతుంది?"
          : "How do stomatal structures compare across fields?",
      };
  }
}

export function modeLabel(mode: LabMode, locale: Locale): string {
  const dict = getDictionary(locale);
  return mode === "simulation" ? dict.common.simulation : dict.common.experiment;
}
