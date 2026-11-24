import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { GlassBack } from "@/components/GlassBack";
import { AppHeader } from "@/components/AppHeader";
import { StudentActivityCards } from "@/components/StudentActivity";
import { getCurrentSession, getRequestLocale } from "@/lib/auth";
import { listStudentActivity } from "@/lib/student-activity";

const pageSize = 9;

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ q?: string; mode?: string; page?: string }> }) {
  const [auth, locale, filters] = await Promise.all([getCurrentSession(), getRequestLocale(), searchParams]);
  if (!auth) redirect("/sign-in?next=/student/activity");
  if (auth.role !== "student") notFound();

  const te = locale === "te-IN";
  const text = typeof filters.q === "string" ? filters.q.trim().slice(0, 120) : "";
  const mode = filters.mode === "simulation" || filters.mode === "experiment" ? filters.mode : "";
  const rawPage = Number(filters.page);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 && rawPage <= 10000 ? rawPage : 1;
  const rows = await listStudentActivity(auth, { limit: pageSize + 1, offset: (page - 1) * pageSize, text, mode });

  function pageHref(value: number) {
    return "/student/activity?" + new URLSearchParams({ q: text, mode, page: String(value) });
  }

  return (
    <>
      <AppHeader auth={auth} locale={locale} variant="student" />
      <main data-workspace="student" className="g1-premium g1-public-shell" id="main-content">
        <GlassBack href="/student" label={te ? "విద్యార్థి డ్యాష్‌బోర్డ్" : "Student Dashboard"} />
        <header className="g1-public-heading g1-mode-heading g1-workspace-banner"><h1>{te ? "నా ప్రయోగాల చరిత్ర" : "My laboratory journey"}</h1></header>
        <form className="g1-discovery-form g1-activity-filters" action="/student/activity" role="search">
          <label><span>{te ? "ప్రయోగం వెతకండి" : "Search activity"}</span><input type="search" name="q" defaultValue={text} maxLength={120} /></label>
          <label><span>{te ? "మోడ్" : "Mode"}</span><select name="mode" defaultValue={mode}>
            <option value="">{te ? "అన్ని మోడ్‌లు" : "All modes"}</option>
            <option value="simulation">{te ? "సిమ్యులేషన్ మోడ్" : "Simulation Mode"}</option>
            <option value="experiment">{te ? "ఎక్స్‌పెరిమెంట్ మోడ్" : "Experiment Mode"}</option>
          </select></label>
          <div className="g1-discovery-actions"><button className="g1-btn g1-btn-teal">{te ? "వెతకండి" : "Search"}</button></div>
        </form>
        <section className="g1-public-section" aria-label={te ? "ప్రయోగాల చరిత్ర" : "Activity history"}>
          {rows.length ? <StudentActivityCards items={rows.slice(0, pageSize)} locale={locale} /> :
            <p className="g1-card g1-info-card">{te ? "ఈ ఎంపికకు కార్యకలాపాలు లేవు." : "No activities match these filters."}</p>}
          <nav className="g1-public-actions" aria-label={te ? "పేజీలు" : "Activity pages"}>
            {page > 1 && <Link href={pageHref(page - 1)} className="g1-btn g1-btn-outline">{te ? "మునుపటి పేజీ" : "Previous page"}</Link>}
            {rows.length > pageSize && <Link href={pageHref(page + 1)} className="g1-btn g1-btn-outline">{te ? "తదుపరి పేజీ" : "Next page"}</Link>}
          </nav>
        </section>
      </main>

    </>
  );
}
