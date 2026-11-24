import { notFound, redirect } from "next/navigation";
import { GlassBack } from "@/components/GlassBack";
import { AppHeader } from "@/components/AppHeader";
import { CreatorProvisionForm } from "@/components/CreatorProvisionForm";
import { getCurrentSession, getRequestLocale } from "@/lib/auth";
import { creatorProvisioningMode } from "@/lib/creator-provisioning";

export default async function CreatorProvisionPage() {
  const [auth, locale] = await Promise.all([getCurrentSession(), getRequestLocale()]);
  if (!auth) redirect("/sign-in?next=/admin/creators");
  const provisioning = creatorProvisioningMode(auth);
  if (!provisioning) notFound();
  const te = locale === "te-IN";
  return <>
    <AppHeader auth={auth} locale={locale} variant="admin" />
    <main id="main-content" data-workspace="admin" className="g1-premium g1-public-shell">
      <GlassBack href="/admin" label={locale === "te-IN" ? "పరిపాలనకు తిరిగి" : "Back to administration"} />
      <header className="g1-public-heading g1-mode-heading g1-mode-heading-exp">
        <h1>{provisioning === "synthetic"
          ? (te ? "స్థానిక రచయిత ఖాతాను సృష్టించండి" : "Create a local creator account")
          : (te ? "రచయిత ఖాతాను సృష్టించండి" : "Create a creator account")}</h1>
        <p>{te ? "రచయితకు ఖాతా పేరు మరియు పాస్‌వర్డ్ ఇవ్వండి. రచయితలు ప్రయోగాలను సమీక్షకు పంపవచ్చు."
          : "Choose an account name and password for an author. Creator accounts can submit content for review."}</p>
      </header>
      <CreatorProvisionForm locale={locale} />
    </main>
  </>;
}
