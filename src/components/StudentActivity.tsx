import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { StudentActivity } from "@/lib/student-activity";
import { getDictionary, getExperimentCopy } from "@/lib/i18n";
import type { Locale } from "@/lib/types";

export function StudentActivityCards({ items, locale }: { items: StudentActivity[]; locale: Locale }) {
  const te = locale === "te-IN";
  const subjects = getDictionary(locale).subjects;
  return (
    <ul className="g1-activity-grid">
      {items.map(item => {
        const copy = getExperimentCopy(item.experiment_id, locale, item.subject);
        const simulation = item.mode === "simulation";
        return (
          <li key={item.session_id} className="g1-card g1-activity-card g1-linked-card" data-subject={item.subject}>
            <span className={"g1-tag " + (simulation ? "g1-tag-blue" : "g1-tag-green")}>
              {simulation ? (te ? "సిమ్యులేషన్ మోడ్" : "Simulation Mode") : (te ? "ఎక్స్‌పెరిమెంట్ మోడ్" : "Experiment Mode")}
            </span>
            <p className="g1-activity-subject">{subjects[item.subject].name}</p>
            <h3>{te ? item.title_te ?? copy.shortTitle : item.title}</h3>
            <p>{item.status === "submitted" ? (te ? "సమర్పించారు" : "Submitted") : (te ? "కొనసాగుతోంది" : "In progress")}
              {" · "}{te ? "చెక్‌పాయింట్" : "Checkpoint"} {item.revision}</p>
            {simulation && item.total > 0 && <p>{item.completed}/{item.total} {te ? "అభ్యాస దశలు" : "guided steps"}</p>}
            <time dateTime={item.saved_at.toISOString()}>{new Intl.DateTimeFormat(locale, {
              dateStyle: "medium", timeZone: "Asia/Kolkata",
            }).format(item.saved_at)}</time>
            <Link className="g1-text-link g1-card-target" href={"/player/" + item.session_id}>
              {item.status === "submitted" ? (te ? "ఫలితాలు చూడండి" : "Review results") : (te ? "కొనసాగించండి" : "Resume lab")}
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
