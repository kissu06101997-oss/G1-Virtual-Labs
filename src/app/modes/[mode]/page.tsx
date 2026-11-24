import Link from "next/link";
import { notFound } from "next/navigation";
import { GlassBack } from "@/components/GlassBack";
import { AppHeader } from "@/components/AppHeader";
import { ModeLauncher } from "@/components/ModeLauncher";
import { getCurrentSession, getRequestLocale } from "@/lib/auth";
import { listCatalogExperiments } from "@/lib/catalog";
import { formatStageLabel } from "@/lib/education-stages";
import { getDictionary, getExperimentCopy } from "@/lib/i18n";
import { getLearningContent, getLearningProgress } from "@/lib/learning";
import { listDiscoveryMetadata } from "@/lib/lessons";

const rangeLabels: Record<string, readonly [string, string]> = {
  zincUmol: ["Zinc amount", "జింక్ పరిమాణం"],
  acidEqUmol: ["Acid equivalents", "ఆమ్ల సమానాలు"],
  incidentAngleDeg: ["Incident angle", "పతన కోణం"],
  slabThicknessMm: ["Slab thickness", "గాజు దిమ్మె మందం"],
  fixturePlaneIndex: ["Image plane index", "చిత్ర తల సూచిక"],
};

export default async function ModePage({ params, searchParams }: {
  params: Promise<{ mode: string }>;
  searchParams: Promise<{ practical?: string }>;
}) {
  const [{ mode }, { practical }] = await Promise.all([params, searchParams]);
  if (mode !== "simulation" && mode !== "experiment") notFound();
  const [auth, locale, items, metadata] = await Promise.all([
    getCurrentSession(), getRequestLocale(), listCatalogExperiments(), listDiscoveryMetadata(),
  ]);
  const te = locale === "te-IN";
  const lang = te ? "te" : "en";
  const isSimulation = mode === "simulation";
  const dict = getDictionary(locale);
  const base = `/modes/${mode}`;
  const practicals = items.filter(item => item.publishedAt && item.publicationStatus !== "review_pending").map(item => {
    const meta = metadata.find(row => row.experiment_id === item.experimentId && row.content_version === item.contentVersion);
    const copy = getExperimentCopy(item.experimentId, locale, item.subject);
    return { item, copy, title: meta?.experiment_title?.[lang] ?? copy.shortTitle };
  });
  const selected = practical === undefined ? practicals[0] : practicals.find(entry => entry.item.experimentId === practical);
  if (practical !== undefined && !selected) notFound();

  const exp = selected?.item;
  const [learning, progress] = exp ? await Promise.all([
    getLearningContent(exp.experimentId, exp.contentVersion),
    isSimulation ? null : getLearningProgress(auth, exp.experimentId, exp.contentVersion),
  ]) : [null, null];
  const canLaunch = auth?.role === "student" || auth?.role === "teacher";
  const title = isSimulation ? dict.detail.simTitle : dict.detail.expTitle;
  const stages = [
    [te ? "లక్ష్యం" : "Aim", learning?.aim[lang] ?? (te ? "మార్గదర్శక ప్రయోగంలో అభ్యాస లక్ష్యాన్ని తెలుసుకోండి." : "Review the learning objective in the guided lab.")],
    [te ? "సిద్ధాంతం & విధానం" : "Theory & Procedure", te ? "మార్గదర్శక ప్రయోగంలో దశలను క్రమంగా పూర్తి చేయండి." : "Follow the ordered steps in the guided lab and record the observations it confirms."],
    [te ? "యానిమేషన్ వీడియో" : "Animation Video", learning?.videoId
      ? (te ? "అభ్యాసంలో ప్రచురించిన వీడియోను చూడండి." : "Watch the version’s published video in the learning journey.")
      : learning ? (te ? "వీడియోకు బదులుగా అందుబాటులో ఉన్న పాఠ్యాన్ని చదవండి." : "Use the published accessible alternative in the learning journey.")
        : (te ? "ఈ ప్రయోగానికి ప్రత్యేక వీడియో ప్రచురించబడలేదు." : "A separate video has not been published for this practical.")],
    [te ? "ఫలితం" : "Result", te ? "ప్రయోగంలో నమోదైన పరిశీలనలు మరియు ఫలితాలను చూడండి." : "Review the observations confirmed during the practical."],
    [te ? "మూల్యాంకనం" : "Assessment", learning
      ? (te ? "అభ్యాసంలో ఐదు ప్రశ్నలకు సమాధానం ఇవ్వండి." : "Answer the five questions in the learning journey.")
      : (te ? "మార్గదర్శక ప్రయోగంలో మీ పరిశీలనలను మూల్యాంకనానికి సమర్పించండి." : "Submit your work in the guided lab for the existing practical assessment.")],
  ];
  const ranges = Object.entries(exp?.supportedVariableRanges ?? {}).filter(([, range]) => range.admission !== "pending_approval");

  return <>
    <AppHeader auth={auth} locale={locale} />
    <main id="main-content" className="g1-public-shell g1-premium g1-mode-overview" data-subject={exp?.subject} data-mode={mode}>
      <GlassBack href="/" label={te ? "ముఖపుటకు తిరిగి" : "Back to home"} />
      <header className={`g1-public-heading g1-mode-heading g1-mode-banner ${isSimulation ? "g1-mode-heading-sim" : "g1-mode-heading-exp"}`}>
        <h1>{title}</h1>
        <p>{isSimulation ? dict.detail.simDesc : dict.detail.expDesc}</p>
      </header>
      {selected && exp ? <>
        <nav className="flex flex-wrap gap-3" aria-label={te ? "ప్రయోగాన్ని ఎంచుకోండి" : "Choose a practical"}>
          {practicals.map(entry => <Link key={entry.item.experimentId}
            className={`g1-btn ${entry === selected ? (isSimulation ? "g1-btn-blue" : "g1-btn-green") : "g1-btn-outline"}`}
            href={`${base}?${new URLSearchParams({ practical: entry.item.experimentId })}`} aria-current={entry === selected ? "page" : undefined}>
            {entry.title}
          </Link>)}
        </nav>
        <section className="g1-mode-practical mt-8" aria-labelledby="mode-practical-title">
          <h2 id="mode-practical-title" className="g1-section-title">{selected.title}</h2>
          <p>{formatStageLabel(exp.grade, locale)} · {dict.subjects[exp.subject].name}</p>
          {isSimulation ? (
            <ol className="g1-mode-stages g1-info-grid [&_h3]:text-lg [&_h3]:font-extrabold" aria-label={te ? "సిమ్యులేషన్ దశలు" : "Simulation stages"}>
              {stages.map(([name, detail]) => <li key={name} className="g1-card g1-info-card"><h3>{name}</h3><p>{detail}</p></li>)}
            </ol>
          ) : <div className="g1-info-grid [&_h3]:text-lg [&_h3]:font-extrabold">
            <section className="g1-card g1-info-card">
              <h3>{te ? "చరరాశులు" : "Variables"}</h3>
              {ranges.length ? <ul>{ranges.map(([name, range]) => <li key={name}>
                {rangeLabels[name]?.[te ? 1 : 0] ?? name}: {range.min}–{range.max}{range.unit === "1" ? "" : ` ${range.unit}`}
              </li>)}</ul> : <p>{te ? "ప్రయోగశాలలో అనుమతించిన ఎంపికలను చూడండి." : "Open the lab to see the permitted settings for this practical."}</p>}
            </section>
            <section className="g1-card g1-info-card"><h3>{te ? "పదార్థాలు, పరికరాలు" : "Materials and apparatus"}</h3><p>{selected.copy.apparatusText}</p></section>
            <section className="g1-card g1-info-card"><h3>{te ? "పరిస్థితులు" : "Conditions"}</h3><p>{selected.copy.modelLimitNote}</p></section>
            <section className="g1-card g1-info-card"><h3>{te ? "పరిశీలనలు" : "Observations"}</h3><p>{te ? "ప్రయోగశాల ధృవీకరించిన పరిశీలనలను నమోదు చేయండి." : "Record the observations confirmed by the lab."}</p></section>
            <section className="g1-card g1-info-card"><h3>{te ? "పోలికలు" : "Comparisons"}</h3><p>{te ? "అనుమతించిన మార్పులతో చేసిన ట్రయల్స్‌ను పోల్చండి." : "Compare confirmed trials using permitted changes."}</p></section>
            <section className="g1-card g1-info-card"><h3>{te ? "ఆధారాలు, నిర్ధారణ" : "Evidence and conclusion"}</h3><p>{te ? "నమోదైన పరిశీలనలతో మీ నిర్ధారణను వివరించండి." : "Support your conclusion with the observations saved during the trial."}</p></section>
          </div>}
        </section>
        <ModeLauncher onlyMode={mode} returnHref={`${base}?${new URLSearchParams({ practical: exp.experimentId })}`}
          experimentId={exp.experimentId} labId={exp.labId} contentVersion={exp.contentVersion}
          manifestSha256={exp.manifestSha256} engineAbi={exp.engineAbi} publicationStatus={exp.publicationStatus}
          locale={locale} isSignedIn={Boolean(auth)} canLaunch={canLaunch} isTeacherPreview={auth?.role === "teacher"}
          learningHref={isSimulation && learning && auth?.role !== "teacher"
            ? `/experiments/${encodeURIComponent(exp.experimentId)}/learn/${encodeURIComponent(exp.contentVersion)}` : undefined}
          journeyLocked={!isSimulation && Boolean(learning) && auth?.role === "student" && progress?.completed_stage !== 5} />
      </> : <p>{te ? "ప్రచురించిన ప్రయోగాలు ఇంకా అందుబాటులో లేవు." : "No published practicals are available yet."}</p>}
    </main>

  </>;
}
