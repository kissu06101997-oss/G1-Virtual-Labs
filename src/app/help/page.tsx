import Link from "next/link";
import Image from "next/image";
import { GlassBack } from "@/components/GlassBack";
import { AppHeader } from "@/components/AppHeader";
import { getCurrentSession, getRequestLocale } from "@/lib/auth";

const articles = [
  { id: "get-started", en: ["Get started", "Open Laboratories, choose Chemistry, Biology or Physics, and use the Class and Lesson filters to narrow the list. Select View experiment to read the aim and see the available modes."],
    te: ["మొదలు పెట్టండి", "ప్రయోగశాలలు తెరిచి రసాయన, జీవ లేదా భౌతిక శాస్త్రాన్ని ఎంచుకోండి. తరగతి, పాఠం ద్వారా వెతికి, ప్రయోగం చూడండి అనే లింకుతో లక్ష్యం మరియు మోడ్‌లను చూడండి."] },
  { id: "simulation-mode", en: ["Simulation Mode", "Use the blue mode to practise the method. Follow the guided steps and check the observations after each confirmed action. In the glass slab practical you can compare how a ray travels before and after entering the slab."],
    te: ["సిమ్యులేషన్ మోడ్", "నీలం రంగు మోడ్‌లో పద్ధతిని సాధన చేయండి. మార్గదర్శక దశల తర్వాత నమోదైన పరిశీలనలను చూడండి. గాజు దిమ్మె ప్రయోగంలో కాంతి మార్గాన్ని పరిశీలించవచ్చు."] },
  { id: "learning-journey", en: ["Your five-step learning journey", "Where a practical includes a learning journey, start with Aim, complete Theory & Procedure in the guided lab, use the video or accessible alternative, read Result & Explanation, and submit all five assessment answers. Completing those steps unlocks Experiment Mode for that version."],
    te: ["మీ ఐదు అభ్యాస దశలు", "అభ్యాస దశలు ఉన్న ప్రయోగంలో లక్ష్యం నుంచి మొదలు పెట్టండి. మార్గదర్శక ప్రయోగంలో సిద్ధాంతం, విధానం పూర్తి చేయండి. వీడియో లేదా ప్రత్యామ్నాయం చూసి ఫలిత వివరణ చదవండి. ఐదు సమాధానాలు సమర్పించిన తర్వాత ఆ వెర్షన్‌లో ఎక్స్‌పెరిమెంట్ మోడ్ తెరుచుకుంటుంది."] },
  { id: "experiment-mode", en: ["Experiment Mode", "Use the green mode to test a question. Change one supported variable at a time and record a comparison. For glass slab refraction, try changing the angle while keeping thickness fixed. The result is theoretical."],
    te: ["ఎక్స్‌పెరిమెంట్ మోడ్", "ఆకుపచ్చ మోడ్‌లో ప్రశ్నను పరీక్షించండి. ఒకేసారి ఒక అనుమతించిన చరరాశిని మార్చి పోలికను నమోదు చేయండి. గాజు మందం మార్చకుండా కోణాన్ని మార్చి చూడండి. ఫలితం సిద్ధాంతపరమైనది."] },
  { id: "dashboard", en: ["Account and dashboard", "Sign in using the account your school provided. Open Student, then Dashboard, to see your assignments, resume a lab or revisit your submitted work. Ask your teacher for help if you cannot sign in."],
    te: ["ఖాతా, డ్యాష్‌బోర్డ్", "మీ పాఠశాల ఇచ్చిన ఖాతాతో సైన్ ఇన్ చేయండి. పనులు చూడటానికి, ప్రయోగం కొనసాగించటానికి లేదా సమర్పణలు చూడటానికి విద్యార్థి విభాగం తెరిచి డ్యాష్‌బోర్డ్ ఎంచుకోండి. సైన్ ఇన్ సమస్య ఉంటే ఉపాధ్యాయుడిని అడగండి."] },
  { id: "playing-a-lab", en: ["Playing a lab", "You can use the Equipment list or Accessible controls instead of the illustration. Press Tab to move between controls and Enter or Space to activate a button. Check that your work is saved before you leave."],
    te: ["ప్రయోగం చేయడం", "చిత్రానికి బదులుగా పరికరాల జాబితా లేదా అందుబాటు నియంత్రణలను వాడండి. Tab ద్వారా నియంత్రణల మధ్య కదలండి. బటన్ కోసం Enter లేదా Space నొక్కండి. బయటకు వెళ్లే ముందు చివరి సేవ్‌ను చూడండి."] },
  { id: "teachers", en: ["For teachers", "Open the teacher workspace to choose a class, set up an assignment, and check results. Reports show the submitted evidence for your authorized classes."],
    te: ["ఉపాధ్యాయుల కోసం", "తరగతిని ఎంచుకోవడానికి, పని ఇవ్వడానికి, ఫలితాలు చూడడానికి ఉపాధ్యాయ కార్యస్థలాన్ని తెరవండి. మీకు అనుమతి ఉన్న తరగతుల సమర్పణలు నివేదికల్లో కనిపిస్తాయి."] },
  { id: "troubleshooting", en: ["Troubleshooting", "If your connection drops, wait for it to return and use Retry pending action if shown. If the lab is blank, refresh once and resume from the dashboard. If the same error returns, note the experiment title and ask your teacher for help."],
    te: ["సమస్యల పరిష్కారం", "కనెక్షన్ పోతే తిరిగి వచ్చిన తర్వాత, కనిపిస్తే పెండింగ్ చర్యను మళ్లీ ప్రయత్నించండి. ప్రయోగశాల ఖాళీగా ఉంటే ఒకసారి రిఫ్రెష్ చేసి డ్యాష్‌బోర్డ్ ద్వారా కొనసాగించండి. సమస్య మళ్లీ వస్తే ప్రయోగం పేరు ఉపాధ్యాయుడికి చెప్పండి."] },
];

export default async function HelpPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [auth, locale, params] = await Promise.all([getCurrentSession(), getRequestLocale(), searchParams]);
  const te = locale === "te-IN";
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 120) : "";
  const results = articles.filter(article => [article.id, ...article.en, ...article.te].join(" ").toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <AppHeader auth={auth} locale={locale} />
      <main className="g1-public-shell g1-premium" id="main-content">
        <GlassBack href="/" label={locale === "te-IN" ? "ముఖపుటకు తిరిగి" : "Back to home"} />
        <header className="g1-public-heading">
          <h1>{te ? "మీకు ఎలా సహాయం చేయగలం?" : "How can we help you?"}</h1>
          <p>{te ? "ప్రయోగం ఎంచుకోవడం, కొనసాగించడం, ఫలితాలు చూడటం తెలుసుకోండి." : "Find answers about choosing a lab, keeping your work and reviewing your results."}</p>
        </header>
        <div className="g1-card g1-public-feature g1-help-feature">
        <form action="/help" className="g1-info-card g1-help-search" role="search">
          <label><span>{te ? "సహాయ వ్యాసాలను వెతకండి" : "Search help articles"}</span><input type="search" name="q" defaultValue={q} maxLength={120} /></label>
          <button className="g1-btn g1-btn-teal">{te ? "వెతకండి" : "Search"}</button>
          {q && <Link href="/help" className="g1-text-link">{te ? "తొలగించండి" : "Clear search"}</Link>}
        </form>
        <Image src="/assets/homepage/science-bench.webp" alt="" width={2171} height={297} />
        </div>
        <div className="g1-info-grid" id="learning-modes">
          {results.map(article => {
            const [title, copy] = te ? article.te : article.en;
            return <article key={article.id} id={article.id}
              data-mode={article.id === "simulation-mode" ? "simulation" : article.id === "experiment-mode" ? "experiment" : undefined}
              className="g1-card g1-info-card">
              <h2>{title}</h2><p>{copy}</p>
              {article.id === "get-started" && <Link className="g1-text-link" href="/laboratories">{te ? "ప్రయోగశాలలను చూడండి" : "Browse laboratories"}</Link>}
              {article.id === "dashboard" && <Link className="g1-text-link" href={auth?.role === "student" ? "/student" : "/sign-in?next=/student"}>{te ? "డ్యాష్‌బోర్డ్ తెరవండి" : "Open your dashboard"}</Link>}
              {article.id === "teachers" && <Link className="g1-text-link" href={auth?.role === "teacher" ? "/teacher" : "/sign-in?role=teacher"}>{te ? "ఉపాధ్యాయ కార్యస్థలం" : "Teacher workspace"}</Link>}
            </article>;
          })}
        </div>
        {!results.length && <p className="g1-card g1-info-card mt-4">{te ? "సరిపోలే వ్యాసాలు లేవు." : "No help articles match your search."}</p>}
        <section className="g1-card g1-info-card g1-public-section" id="contact">
          <h2>{te ? "పాఠశాల ఖాతాకు సహాయం" : "School account support"}</h2>
          <p>{te ? "పాఠశాల ఖాతా లేదా తరగతి పనికి సహాయం కావాలంటే మీ ఉపాధ్యాయుడిని సంప్రదించండి."
            : "For help with a school account or class assignment, contact your teacher."}</p>
          <Link href="/contact" className="g1-text-link">{te ? "మమ్మల్ని సంప్రదించండి" : "Contact Us"}</Link>
        </section>
      </main>

    </>
  );
}
