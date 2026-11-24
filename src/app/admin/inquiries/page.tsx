import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { GlassBack } from "@/components/GlassBack";
import { getCurrentSession, getRequestLocale } from "@/lib/auth";
import { INQUIRY_CATEGORIES, VISITOR_TYPES } from "@/lib/contact";
import type { ContactInquiry } from "@/lib/contact-inquiries";
import { query } from "@/lib/db";
import "../../contact/contact.css";

const PAGE_SIZE = 25;
const notificationLabels = {
  disabled: ["Email notifications off", "ఈమెయిల్ నోటిఫికేషన్లు నిలిపివేయబడ్డాయి"],
  pending: ["Email notification status pending", "ఈమెయిల్ నోటిఫికేషన్ స్థితి ఇంకా తెలియదు"],
  accepted: ["Email provider accepted the notification", "ఈమెయిల్ సేవ నోటిఫికేషన్‌ను స్వీకరించింది"],
  failed: ["Email notification could not be confirmed", "ఈమెయిల్ నోటిఫికేషన్ నిర్ధారించబడలేదు"],
} as const;

export default async function ContactInbox({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const [auth, locale, params] = await Promise.all([getCurrentSession(), getRequestLocale(), searchParams]);
  if (!auth) redirect("/sign-in?next=/admin/inquiries");
  if (auth.role !== "operator") notFound();

  const te = locale === "te-IN";
  const language = te ? 1 : 0;
  const page = typeof params.page === "string" && /^[1-9]\d{0,5}$/.test(params.page) ? Number(params.page) : 1;
  const { rows } = await query<{
    inquiry_id: string;
    received_at: Date;
    details: ContactInquiry;
    notification_status: keyof typeof notificationLabels;
  }>(`SELECT inquiry_id, received_at, details, notification_status FROM contact_inquiry
    ORDER BY received_at DESC, inquiry_id DESC LIMIT $1 OFFSET $2`, [PAGE_SIZE + 1, (page - 1) * PAGE_SIZE]);
  const when = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

  return <>
    <AppHeader auth={auth} locale={locale} variant="admin" />
    <main id="main-content" className="g1-public-shell g1-premium g1-contact-inbox">
      <GlassBack href="/admin" label={te ? "నిర్వహణకు తిరిగి" : "Back to administration"} />
      <header className="g1-public-heading"><h1>{te ? "సంప్రదింపు విచారణలు" : "Contact inquiries"}</h1></header>
      {rows.length === 0 && <p>{te ? "ఈ పేజీలో విచారణలు లేవు." : "There are no inquiries on this page."}</p>}
      {rows.slice(0, PAGE_SIZE).map(({ inquiry_id, received_at, details, notification_status }) =>
        <article key={inquiry_id} className="g1-card g1-info-card">
          <h2>{details.subject}</h2>
          <p><time dateTime={received_at.toISOString()}>{when.format(received_at)}</time> · {notificationLabels[notification_status][language]}</p>
          <p>{details.name} · <a href={`mailto:${details.email}`} className="g1-text-link">{details.email}</a>
            {details.phone && <> · {details.phone}</>}{details.institution && <> · {details.institution}</>}</p>
          <p>{VISITOR_TYPES[details.visitor][language]} · {INQUIRY_CATEGORIES[details.category][language]}</p>
          <p className="g1-contact-inquiry-message">{details.message}</p>
        </article>
      )}
      {(page > 1 || rows.length > PAGE_SIZE) && <nav className="flex flex-wrap gap-3" aria-label={te ? "విచారణ పేజీలు" : "Inquiry pages"}>
        {page > 1 && <Link className="g1-btn g1-btn-outline" href={`?page=${page - 1}`}>{te ? "మునుపటి పేజీ" : "Previous"}</Link>}
        {rows.length > PAGE_SIZE && <Link className="g1-btn g1-btn-outline" href={`?page=${page + 1}`}>{te ? "తదుపరి పేజీ" : "Next"}</Link>}
      </nav>}
    </main>
  </>;
}
