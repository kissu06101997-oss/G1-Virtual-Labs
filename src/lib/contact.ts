export const CONTACT = {
  organization: "G1 Virtual Labs",
  founder: "NUNAVATHU JEEVAN NAYAK",
  email: "yuvaratna06101997@gmail.com",
  phone: "+919494054316",
  phoneLabel: "+91 94940 54316",
  hours: "10:00 AM – 6:00 PM IST",
  get whatsappUrl() {
    return `https://wa.me/${this.phone.slice(1)}`;
  },
} as const;

export const VISITOR_TYPES = {
  student: ["Student", "విద్యార్థి"],
  parent: ["Parent or Guardian", "తల్లిదండ్రులు లేదా సంరక్షకులు"],
  teacher: ["Teacher", "ఉపాధ్యాయులు"],
  institution: ["School or College Representative", "పాఠశాల లేదా కళాశాల ప్రతినిధి"],
  researcher: ["Researcher", "పరిశోధకులు"],
  collaborator: ["Potential Collaborator", "సహకారంపై ఆసక్తి ఉన్నవారు"],
  other: ["Other", "ఇతరులు"],
} as const;

export const INQUIRY_CATEGORIES = {
  general: ["General Inquiry", "సాధారణ విచారణ"],
  student: ["Student Support", "విద్యార్థి సహాయం"],
  teacher: ["Teacher Support", "ఉపాధ్యాయ సహాయం"],
  partnership: ["School or College Partnership", "పాఠశాల లేదా కళాశాల భాగస్వామ్యం"],
  demo: ["Product Demonstration", "వేదిక ప్రదర్శన"],
  technical: ["Technical Support", "సాంకేతిక సహాయం"],
  content: ["Laboratory Content Inquiry", "ప్రయోగశాల కంటెంట్‌పై విచారణ"],
  collaboration: ["Collaboration Opportunity", "సహకార అవకాశం"],
  feedback: ["Feedback and Suggestions", "అభిప్రాయాలు, సూచనలు"],
  other: ["Other", "ఇతర అంశం"],
} as const;

export const CONTACT_LIMITS = { name: 100, email: 254, phone: 30, institution: 160, subject: 160, message: 3000 } as const;
