import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { getCurrentSession, getRequestLocale } from "@/lib/auth";

export default async function MissingPage() {
  const [auth, locale] = await Promise.all([getCurrentSession(), getRequestLocale()]);
  const te = locale === "te-IN";

  return <>
    <AppHeader auth={auth} locale={locale} />
    <main id="main-content" className="g1-premium g1-public-shell">
      <section className="g1-card g1-welcome" aria-labelledby="missing-page-title">
        <FlaskConical size={32} aria-hidden="true" />
        <h1 id="missing-page-title" className="g1-section-title">
          {te ? "ఈ పేజీ అందుబాటులో లేదు" : "This page is unavailable"}
        </h1>
        <p>{te ? "అందుబాటులో ఉన్న ప్రయోగాలను చూడండి లేదా ముఖపుటకు వెళ్లండి." : "Browse the available practicals or return to the homepage."}</p>
        <div className="flex flex-wrap gap-3">
          <Link className="g1-btn g1-btn-teal" href="/laboratories">{te ? "ప్రయోగశాలలు" : "Browse laboratories"}</Link>
          <Link className="g1-btn g1-btn-outline" href="/">{te ? "ముఖపుట" : "Home"}</Link>
        </div>
      </section>
    </main>
  </>;
}
