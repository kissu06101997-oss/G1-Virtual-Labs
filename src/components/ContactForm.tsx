"use client";

import { useRef, useState, type FormEvent } from "react";
import { Send } from "lucide-react";
import { CONTACT_LIMITS, INQUIRY_CATEGORIES, VISITOR_TYPES } from "@/lib/contact";
import type { Locale } from "@/lib/types";
import { FluidSelect } from "./FluidSelect";

const copy = {
  en: {
    heading: "Send an inquiry",
    intro: "Tell us what you need and how we can reach you.",
    name: "Full name", email: "Email address", phone: "Phone number", institution: "Institution or organization name",
    visitor: "Visitor type", category: "Inquiry category", subject: "Subject", message: "Message",
    optional: "optional", choose: "Select an option",
    privacy: "Please leave out passwords, student IDs and sensitive school records.",
    consent: "I agree that G1 Virtual Labs may use the information I provide to respond to this inquiry.",
    send: "Send Message", sending: "Recording…",
    recorded: "Your inquiry has been recorded. Thank you for contacting G1 Virtual Labs.",
    duplicate: "This inquiry was already recorded.",
    limited: "Too many attempts. Please wait 15 minutes or use an official contact channel.",
    unavailable: "We couldn’t confirm receipt. You can retry or use an official contact channel.",
    invalid: "Check the highlighted fields and try again.",
    field: "Enter a valid value for this field.",
    consentError: "Please confirm that we may use your details to respond.",
  },
  te: {
    heading: "మీ విచారణను పంపండి",
    intro: "మీకు ఏ సహాయం కావాలో, మేము మిమ్మల్ని ఎలా సంప్రదించాలో తెలియజేయండి.",
    name: "పూర్తి పేరు", email: "ఈమెయిల్ చిరునామా", phone: "ఫోన్ నంబర్", institution: "విద్యాసంస్థ లేదా సంస్థ పేరు",
    visitor: "సందర్శకుడి రకం", category: "విచారణ విభాగం", subject: "విషయం", message: "సందేశం",
    optional: "ఐచ్ఛికం", choose: "ఒక ఎంపికను ఎంచుకోండి",
    privacy: "పాస్‌వర్డ్‌లు, విద్యార్థి గుర్తింపు సంఖ్యలు, సున్నితమైన పాఠశాల రికార్డులను పంపవద్దు.",
    consent: "ఈ విచారణకు సమాధానం ఇవ్వడానికి నేను ఇచ్చిన వివరాలను G1 Virtual Labs ఉపయోగించడానికి అంగీకరిస్తున్నాను.",
    send: "సందేశం పంపండి", sending: "నమోదు చేస్తున్నాం…",
    recorded: "మీ విచారణ నమోదైంది. G1 Virtual Labs‌ను సంప్రదించినందుకు ధన్యవాదాలు.",
    duplicate: "ఈ విచారణ ఇప్పటికే నమోదైంది.",
    limited: "చాలా ప్రయత్నాలు జరిగాయి. 15 నిమిషాలు వేచి ఉండండి లేదా అధికారిక సంప్రదింపు మార్గాన్ని ఉపయోగించండి.",
    unavailable: "మీ విచారణ అందినట్లు నిర్ధారించలేకపోయాం. మళ్లీ ప్రయత్నించండి లేదా అధికారిక సంప్రదింపు మార్గాన్ని ఉపయోగించండి.",
    invalid: "సూచించిన ఫీల్డ్‌లను సరిచూసి మళ్లీ ప్రయత్నించండి.",
    field: "ఈ ఫీల్డ్‌లో సరైన వివరాలను నమోదు చేయండి.",
    consentError: "సమాధానం కోసం మీ వివరాలను ఉపయోగించడానికి అనుమతించండి.",
  },
};

type Result = "recorded" | "duplicate" | "limited" | "unavailable" | "invalid";

export function ContactForm({ locale }: { locale: Locale }) {
  const te = locale === "te-IN";
  const t = copy[te ? "te" : "en"];
  const [visitor, setVisitor] = useState("");
  const [category, setCategory] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [invalidFields, setInvalidFields] = useState<string[]>([]);
  const busy = useRef(false);
  const status = useRef<HTMLParagraphElement>(null);

  const options = (choices: Record<string, readonly [string, string]>) => [
    { value: "", label: t.choose },
    ...Object.entries(choices).map(([value, labels]) => ({ value, label: labels[te ? 1 : 0] })),
  ];
  const invalid = (name: string) => invalidFields.includes(name);
  const errorId = (name: string) => `contact-${name}-error`;
  const error = (name: string) => invalid(name)
    ? <small className="g1-contact-field-error" id={errorId(name)}>{name === "consent" ? t.consentError : t.field}</small>
    : null;

  function reportInvalid(form: HTMLFormElement, fields: string[]) {
    setInvalidFields(fields);
    setResult("invalid");
    requestAnimationFrame(() => (form.querySelector<HTMLElement>('[aria-invalid="true"]') ?? status.current)?.focus());
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;

    const form = event.currentTarget;
    const values = new FormData(form);
    const fieldNames = ["name", "email", "phone", "institution", "visitor", "category", "subject", "message", "website"] as const;
    const valuesByName = Object.fromEntries(fieldNames.map(name => [name, String(values.get(name) ?? "")]));
    const consent = values.has("consent");
    const issues = fieldNames.filter(name => {
      if (["name", "email", "visitor", "category", "subject", "message"].includes(name) && !valuesByName[name].trim()) return true;
      if (name === "phone" && valuesByName.phone.trim() && !/^[+0-9(). -]+$/.test(valuesByName.phone.trim())) return true;
      const field = form.elements.namedItem(name);
      return field instanceof HTMLInputElement && !field.validity.valid;
    });
    if (issues.length || !consent) {
      reportInvalid(form, consent ? issues : [...issues, "consent"]);
      return;
    }

    busy.current = true;
    setPending(true);
    setResult(null);
    setInvalidFields([]);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...valuesByName, consent }),
        signal: AbortSignal.timeout(12000),
      });
      const { code, fields } = await response.json();
      if (response.ok && (code === "recorded" || code === "duplicate")) {
        form.reset();
        setVisitor("");
        setCategory("");
        setResult(code);
      } else if (response.status === 400 && code === "invalid") {
        reportInvalid(form, Array.isArray(fields) ? fields : []);
        return;
      } else {
        setResult(response.status === 429 ? "limited" : "unavailable");
      }
    } catch {
      setResult("unavailable");
    } finally {
      busy.current = false;
      setPending(false);
    }
    requestAnimationFrame(() => status.current?.focus());
  }

  function textField(name: "name" | "email" | "phone" | "institution" | "subject",
    type: "text" | "email" | "tel", autoComplete?: string, optional?: boolean) {
    return <div className={name === "subject" ? "g1-contact-wide" : undefined}>
      <label htmlFor={`contact-${name}`}>{t[name]}{optional && <small> ({t.optional})</small>}</label>
      <input id={`contact-${name}`} name={name} type={type} autoComplete={autoComplete}
        maxLength={CONTACT_LIMITS[name]} required={!optional} aria-invalid={invalid(name) || undefined}
        aria-describedby={invalid(name) ? errorId(name) : undefined} />
      {error(name)}
    </div>;
  }

  return <section className="g1-card g1-info-card g1-contact-form-panel" aria-labelledby="contact-form-title">
    <h2 id="contact-form-title">{t.heading}</h2>
    <p>{t.intro}</p>
    <form method="post" action="/api/contact" onSubmit={submit} noValidate aria-label={t.heading}>
      <fieldset disabled={pending} className="g1-contact-fields">
        <legend className="sr-only">{t.heading}</legend>
        {textField("name", "text", "name")}
        {textField("email", "email", "email")}
        {textField("phone", "tel", "tel", true)}
        {textField("institution", "text", "organization", true)}
        <div>
          <FluidSelect name="visitor" label={t.visitor} value={visitor} options={options(VISITOR_TYPES)}
            onChange={setVisitor} required disabled={pending} invalid={invalid("visitor")}
            describedBy={invalid("visitor") ? errorId("visitor") : undefined} />
          {error("visitor")}
        </div>
        <div>
          <FluidSelect name="category" label={t.category} value={category} options={options(INQUIRY_CATEGORIES)}
            onChange={setCategory} required disabled={pending} invalid={invalid("category")}
            describedBy={invalid("category") ? errorId("category") : undefined} />
          {error("category")}
        </div>
        {textField("subject", "text")}
        <div className="g1-contact-wide">
          <label htmlFor="contact-message">{t.message}</label>
          <textarea id="contact-message" name="message" rows={5} required maxLength={CONTACT_LIMITS.message}
            aria-invalid={invalid("message") || undefined}
            aria-describedby={invalid("message") ? `contact-privacy ${errorId("message")}` : "contact-privacy"} />
          <small id="contact-privacy">{t.privacy}</small>
          {error("message")}
        </div>
        <div className="g1-contact-trap" aria-hidden="true">
          <label htmlFor="contact-website">Website</label>
          <input id="contact-website" name="website" autoComplete="off" tabIndex={-1} />
        </div>
        <div className="g1-contact-wide">
          <label className="g1-contact-consent">
            <input name="consent" type="checkbox" required aria-invalid={invalid("consent") || undefined}
              aria-describedby={invalid("consent") ? errorId("consent") : undefined} />
            <span>{t.consent}</span>
          </label>
          {error("consent")}
        </div>
        <button type="submit" className="g1-btn g1-btn-teal g1-contact-submit">
          <Send size={17} aria-hidden="true" />{pending ? t.sending : t.send}
        </button>
      </fieldset>
      <p ref={status} tabIndex={-1} className="g1-contact-status" role={result === "invalid" ? "alert" : "status"} data-result={result ?? undefined}>
        {result ? t[result] : ""}
      </p>
    </form>
  </section>;
}
