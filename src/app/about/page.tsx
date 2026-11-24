import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { GlassBack } from "@/components/GlassBack";
import { AppHeader } from "@/components/AppHeader";
import { getCurrentSession, getRequestLocale } from "@/lib/auth";

export default async function AboutPage() {
  const [auth, locale] = await Promise.all([getCurrentSession(), getRequestLocale()]);
  const te = locale === "te-IN";
  return (
    <>
      <AppHeader auth={auth} locale={locale} />
      <main className="g1-public-shell g1-premium" id="main-content">
        <GlassBack href="/" label={locale === "te-IN" ? "ముఖపుటకు తిరిగి" : "Back to home"} />
        <section className="g1-card g1-public-feature g1-about-feature" aria-labelledby="about-title">
        <header className="g1-public-heading g1-info-card">
          <h1 id="about-title">{te ? "G1 Virtual Labs గురించి" : "About G1 Virtual Labs"}</h1>
          <p>{te ? "అర్థం చేసుకోవడానికి, సాధన చేయడానికి, ప్రశ్నించడానికి ఒక సైన్స్ ప్రయోగశాల." : "A place to understand science by practising it and asking what happens next."}</p>
        </header>
        <Image src="/assets/homepage/science-bench.webp" width={2171} height={297}
          alt={te ? "గాజు పాత్రలు, సూక్ష్మదర్శినితో సైన్స్ దృశ్యం" : "Illustrated lab bench with glassware and a microscope"} />
        </section>
        <div className="g1-info-grid">
          <section className="g1-card g1-info-card">
            <h2>{te ? "ఎవరి కోసం?" : "Made for learners and teachers"}</h2>
            <p>{te ? "6వ తరగతి నుంచి ఇంటర్మీడియట్ రెండవ సంవత్సరం వరకు విద్యార్థులు అందుబాటులో ఉన్న ప్రయోగాలను ఇంగ్లీష్ లేదా తెలుగులో కనుగొనవచ్చు. ఉపాధ్యాయులు పనులు ఇచ్చి, విద్యార్థులు సమర్పించిన ఆధారాలను చూడవచ్చు." : "Learners from Class 6 through Intermediate 2nd Year can find available practicals in English or Telugu. Teachers can assign practicals and review the evidence learners submit."}</p>
          </section>
          <section className="g1-card g1-info-card">
            <h2>{te ? "రెండు అభ్యాస మోడ్‌లు" : "Why two learning modes?"}</h2>
            <p>{te ? "సిమ్యులేషన్ మోడ్‌లో పద్ధతిని దశలవారీగా సాధన చేయండి. ఎక్స్‌పెరిమెంట్ మోడ్‌లో అనుమతించిన చరరాశిని మార్చి, ఫలితాలను పోల్చండి." : "Simulation Mode helps you practise a method step by step. Experiment Mode lets you change supported variables and compare what the laboratory model reports."}</p>
            <p>{te ? "కొత్త అభ్యాస ప్రయోగాల్లో లక్ష్యం నుంచి ఐదు ప్రశ్నల మూల్యాంకనం వరకు దశలను పూర్తి చేసి, తర్వాత మీ పరిశోధనను ప్రారంభించండి."
              : "In practicals with a learning journey, work from the aim to a five-question assessment before starting your own investigation."}</p>
            <Link className="g1-text-link" href="/help#learning-modes">{te ? "మోడ్‌ల గురించి తెలుసుకోండి" : "See how the modes work"}</Link>
          </section>
          <section className="g1-card g1-info-card">
            <h2>{te ? "పరిశీలనలను మళ్లీ చూడండి" : "Pick up where you left off"}</h2>
            <p>{te ? "సైన్ ఇన్ చేసిన విద్యార్థులు చివరి చెక్‌పాయింట్ నుంచి కొనసాగవచ్చు, సమర్పించిన పనిని చూడవచ్చు." : "Signed-in learners can resume from a saved checkpoint and look back at submitted work. Each practical explains what its model can report."}</p>
          </section>
          <section className="g1-card g1-info-card">
            <h2>{te ? "భవిష్యత్తులో" : "What’s coming next"}</h2>
            <p>{te ? "పాఠ్యక్రమం, శాస్త్రీయ నమూనా సమీక్ష పూర్తయ్యాక కొత్త ప్రయోగాలు ప్రయోగశాలల్లో చేరతాయి."
              : "New practicals appear in Laboratories after their curriculum and scientific model have been reviewed."}</p>
          </section>
        </div>
        <div className="g1-public-actions"><Link className="g1-btn g1-btn-teal" href="/laboratories">{te ? "ప్రయోగశాలలను చూడండి" : "Explore laboratories"} <ArrowRight size={18} aria-hidden="true" /></Link></div>
      </main>

    </>
  );
}
