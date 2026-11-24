import { notFound, redirect } from "next/navigation";
import { GlassBack } from "@/components/GlassBack";
import { AppHeader } from "@/components/AppHeader";
import { DeviceCapabilityPanel } from "@/components/DeviceCapabilityPanel";
import { getCurrentSession, getRequestLocale } from "@/lib/auth";

export default async function DiagnosticsPage() {
  const [auth, locale] = await Promise.all([getCurrentSession(), getRequestLocale()]);
  if (!auth) redirect("/sign-in?next=/admin/diagnostics");
  if (!["school_admin", "district_admin", "state_admin"].includes(auth.role)) notFound();
  return <>
    <AppHeader auth={auth} locale={locale} variant="admin" />
    <main id="main-content" data-workspace="admin" className="g1-premium g1-public-shell">
      <GlassBack href="/admin" label={locale === "te-IN" ? "పరిపాలనకు తిరిగి" : "Back to administration"} />
      <header className="g1-card g1-student-welcome mb-5"><h1 className="g1-section-title !mb-0">{locale === "te-IN" ? "పరికర నిర్ధారణ" : "Device and service diagnostics"}</h1></header>
      <DeviceCapabilityPanel locale={locale} />
    </main>
  </>;
}
