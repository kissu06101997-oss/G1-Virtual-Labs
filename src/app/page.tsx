import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight, Atom, BookOpen, ChartNoAxesColumnIncreasing, Clock3, FlaskConical, GraduationCap,
  Layers3, Play, ShieldCheck, UsersRound,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { HomeAtom } from "@/components/HomeAtom";
import { HomeSubjectCards } from "@/components/HomeSubjectCards";
import { scienceSubjects } from "@/components/ScienceDestinations";
import { getCurrentSession, getRequestLocale } from "@/lib/auth";
import { EDUCATION_STAGES, resolveEducationStage } from "@/lib/education-stages";
import { getDictionary, getExperimentCopy } from "@/lib/i18n";
import { listStudentActivity } from "@/lib/student-activity";

const subjectDescriptions = {
  chemistry: { en: "Explore reactions, materials and chemical changes.", te: "చర్యలు, పదార్థాలు, రసాయన మార్పులను అన్వేషించండి." },
  physics: { en: "Explore forces, motion, energy and physical laws.", te: "బలాలు, చలనం, శక్తి మరియు భౌతిక నియమాలను అన్వేషించండి." },
  biology: { en: "Explore life, cells, systems and the natural world.", te: "జీవం, కణాలు, జీవ వ్యవస్థలు మరియు ప్రకృతిని అన్వేషించండి." },
} as const;

export default async function HomePage({ searchParams }: { searchParams: Promise<{ grade?: string; stage?: string }> }) {
  const [auth, locale, params] = await Promise.all([getCurrentSession(), getRequestLocale(), searchParams]);
  const activities = await listStudentActivity(auth, { limit: 3 });
  const selectedGrade = resolveEducationStage(params.stage ?? params.grade)?.grade;
  const te = locale === "te-IN";
  const lang = te ? "te" : "en";
  const dict = getDictionary(locale);
  const student = auth?.role === "student";
  const modes = [
    { id: "simulation", label: te ? "సిమ్యులేషన్ మోడ్" : "Simulation Mode",
      description: te ? "దశలవారీ సూచనలు, ఇంటరాక్టివ్ పరికరాలు మరియు నమోదైన పరిశీలనలతో ప్రయోగాన్ని నేర్చుకోండి."
        : "Learn the experiment step by step with guided instructions, interactive apparatus and observations." },
    { id: "experiment", label: te ? "ఎక్స్‌పెరిమెంట్ మోడ్" : "Experiment Mode",
      description: te ? "అనుమతించిన చరరాశులు మరియు పరిస్థితులను మార్చి ప్రయోగ ఫలితాలను పోల్చండి."
        : "Change approved variables and conditions, then compare the results of your trials." },
  ];
  const features = [
    { icon: FlaskConical, text: te ? "పాఠ్యాంశాలకు అనుగుణంగా" : "Curriculum-linked practicals" },
    { icon: Layers3, text: te ? "ఇంటరాక్టివ్ ప్రయోగాలు" : "Interactive experiments" },
    { icon: ChartNoAxesColumnIncreasing, text: te ? "మీ పురోగతిని చూడండి" : "Track your progress" },
    { icon: UsersRound, text: te ? "తెలుగు మరియు ఇంగ్లీష్" : "Bilingual (English & Telugu)" },
    { icon: ShieldCheck, text: te ? "సురక్షిత వర్చువల్ అభ్యాసం" : "Safe virtual learning" },
  ];

  return (
    <>
      <AppHeader locale={locale} auth={auth} homeLayout />
      <main id="main-content" className="g1-home">
        <nav className="g1-class-nav" aria-label={te ? "తరగతి ద్వారా చూడండి" : "Explore by class"} data-testid="education-stage-rail">
          <div className="g1-class-label">
            <span className="g1-class-icon"><GraduationCap aria-hidden="true" size={35} strokeWidth={1.7} /></span>
            <span><strong>{te ? "తరగతి ఎంచుకోండి" : "Explore by class"}</strong>
              <small>{te ? "ఏడు అభ్యాస స్థాయిలు" : "Seven learning stages"}</small></span>
          </div>
          <ul>
            {EDUCATION_STAGES.map(stage => (
              <li key={stage.id}>
                <Link data-testid={"stage-pill-" + stage.id} href={"/laboratories?grade=" + stage.grade}
                  aria-current={selectedGrade === stage.grade ? "true" : undefined}>
                  <BookOpen size={23} strokeWidth={1.75} aria-hidden="true" />
                  {te && stage.labelTe !== stage.shortLabelTe
                    ? <><span className="g1-class-full-te">{stage.labelTe}</span><span className="g1-class-short-te">{stage.shortLabelTe}</span></>
                    : te ? stage.labelTe : stage.shortLabelEn}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <HomeAtom imageDescription={te ? "గాజు పాత్రలు, సూక్ష్మదర్శిని, న్యూటన్ లోలకం, పరమాణువు, చేప శరీర నమూనా, డీఎన్‌ఏ మరియు కణజాలంతో సైన్స్ దృశ్యం"
            : "A laboratory bench with glassware, a microscope, Newton’s cradle, an atom, a fish model, DNA and a histology screen"}>

        <div className="g1-home-panel">
          <div className="g1-home-discovery">
            <section className="g1-home-intro" aria-labelledby="hero-heading">
              <div className="g1-home-intro-title">
              <p className="g1-home-identity">G1 Virtual Labs</p>
              <h1 id="hero-heading">
                {te ? "మీరు అనుభవించగల" : "Science you can"}{" "}
                <span>{te ? "విజ్ఞాన శాస్త్రం." : "experience."}</span>
              </h1>
              </div>
              <p className="g1-home-description">{te
                ? "మార్గదర్శక సిమ్యులేషన్లు, వర్చువల్ పరిశోధనలతో విజ్ఞాన శాస్త్రాన్ని అన్వేషించండి. 6–10 తరగతులు, ఇంటర్మీడియట్ మొదటి మరియు రెండో సంవత్సరాల్లో భావాలను నేర్చుకోండి, ఫలితాలను పరిశీలించండి, ఆధారాలను నమోదు చేయండి."
                : "Explore science with guided simulations and virtual investigations. Learn concepts, observe results and record evidence across Classes 6–10 and Intermediate 1st & 2nd Year."}</p>
              <span className="g1-home-intro-atom" aria-hidden="true"><Atom strokeWidth={1.15} /></span>
            </section>

            <HomeSubjectCards cards={scienceSubjects.map(subject => ({
              subject, title: dict.subjects[subject].name, description: subjectDescriptions[subject][lang],
            }))} />
          </div>

          <div className="g1-home-learning">
            <section className="g1-home-modes" aria-label={te ? "అభ్యాస మోడ్‌లు" : "Learning modes"}>
              {modes.map(mode => <Link className={"g1-home-mode g1-home-mode-" + mode.id} key={mode.id}
                href={"/modes/" + mode.id} data-testid={"home-mode-" + mode.id}>
                <span className="g1-home-mode-art">
                  <Image src={"/assets/homepage/" + mode.id + ".webp"} width={172} height={172} alt="" loading="eager" />
                </span>
                <div>
                  <h2>{mode.label}</h2>
                  <p>{mode.description}</p>
                </div>
                <span className="g1-home-mode-arrow" aria-hidden="true">
                  <ArrowRight size={19} aria-hidden="true" />
                </span>
              </Link>)}
            </section>

            <section className="g1-home-activity" aria-labelledby="continue-heading">
              <div className="g1-home-activity-heading">
                <span className="g1-home-activity-icon"><Clock3 size={28} aria-hidden="true" /></span>
                <div>
                  <h2 id="continue-heading">{te ? "అభ్యాసాన్ని కొనసాగించండి" : "Continue Learning"}</h2>
                  <p>{te ? "మీ ఇటీవలి ప్రయోగశాల కార్యకలాపాలు" : "Your recent laboratory activities"}</p>
                </div>
                {student ? <Link href="/student/activity" className="g1-home-view-all" aria-label={te ? "అన్ని కార్యకలాపాలు" : "View all activity"}>
                  {te ? "అన్నీ చూడండి" : "View all"} <ArrowRight size={16} aria-hidden="true" />
                </Link> : <Link href="/laboratories" data-testid="hero-explore-cta" className="g1-home-view-all">
                  {te ? "ప్రయోగశాలలు చూడండి" : "Browse laboratories"} <ArrowRight size={16} aria-hidden="true" />
                </Link>}
              </div>
              {activities.length ? <ul className="g1-home-activity-list">
                {activities.map(item => {
                  const copy = getExperimentCopy(item.experiment_id, locale);
                  return <li key={item.session_id}>
                    <Link href={"/player/" + item.session_id} className="g1-home-activity-link" data-testid="home-activity-link">
                    <span className="g1-home-activity-media">{item.experiment_id.startsWith("creator-")
                      ? <span className="g1-home-activity-illustration"><FlaskConical size={25} aria-hidden="true" /></span>
                      : <Image src={copy.thumbPath} width={84} height={84} alt="" loading="eager" />}</span>
                    <div>
                      <h3>{te ? item.title_te ?? (item.experiment_id.startsWith("creator-") ? item.title : copy.shortTitle) : item.title}</h3>
                      <p>{item.mode === "simulation" ? modes[0].label : modes[1].label}</p>
                      <span className="g1-home-resume">
                        {item.status === "submitted" ? (te ? "ఫలితాలు చూడండి" : "Review") : (te ? "కొనసాగించండి" : "Resume")}
                        <Play size={12} fill="currentColor" aria-hidden="true" />
                      </span>
                    </div>
                    </Link>
                  </li>;
                })}
              </ul> : <Link href={auth ? "/laboratories" : "/sign-in?next=/student&role=student"} className="g1-home-activity-empty">
                <span className="g1-home-activity-illustration"><BookOpen size={31} aria-hidden="true" /></span>
                <div>
                  <h3>{student ? (te ? "సేవ్ చేసిన ప్రయోగాలు లేవు" : "No saved labs yet") : (te ? "మీ ప్రయోగాలను కొనసాగించండి" : "Pick up where you left off")}</h3>
                  <p>{student ? (te ? "మొదటి ప్రయోగం ప్రారంభించిన తర్వాత ఇక్కడ కనిపిస్తుంది." : "Your first lab will appear here after you start it.")
                    : auth ? (te ? "విద్యార్థులు సేవ్ చేసిన అభ్యాసాన్ని ఇక్కడ కొనసాగించవచ్చు." : "Students can resume their saved labs here.")
                      : (te ? "సేవ్ చేసిన ప్రయోగాలు మరియు పురోగతి చూడటానికి సైన్ ఇన్ చేయండి." : "Sign in to see your saved labs and progress.")}</p>
                </div>
                <span className="g1-home-resume g1-home-empty-action">
                  {auth ? (te ? "ప్రయోగశాలలు చూడండి" : "Browse laboratories") : (te ? "సైన్ ఇన్" : "Sign in")}
                  <ArrowRight size={15} aria-hidden="true" />
                </span>
              </Link>}
            </section>
          </div>

          <ul className="g1-home-benefits" aria-label={te ? "అభ్యాస సదుపాయాలు" : "Learning features"}>
            {features.map(({ icon: Icon, text }) => <li key={text}><Icon size={30} strokeWidth={1.8} aria-hidden="true" />{text}</li>)}
          </ul>
        </div>
        </HomeAtom>
      </main>

    </>
  );
}
