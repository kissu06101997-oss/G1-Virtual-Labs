"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import type { Locale } from "@/lib/types";

interface SignInFormProps {
  locale: Locale;
  nextPath?: string;
  roleHint?: string;
  showSyntheticFixtures?: boolean;
}

const SYNTHETIC_ACCOUNTS = [
  {
    labelEn: "Student A (School A — Guntur, Class 10-A)",
    labelTe: "విద్యార్థి A (పాఠశాల A — గుంటూరు, 10వ తరగతి-A)",
    email: "student.a@school-guntur-01.test",
    role: "student",
  },
  {
    labelEn: "Student B (School B — Vijayawada, Class 10-A)",
    labelTe: "విద్యార్థి B (పాఠశాల B — విజయవాడ, 10వ తరగతి-A)",
    email: "student.b@school-vijayawada-02.test",
    role: "student",
  },
  {
    labelEn: "Teacher A (School A — Guntur, Class 10-A)",
    labelTe: "ఉపాధ్యాయుడు A (పాఠశాల A — గుంటూరు, 10వ తరగతి-A)",
    email: "teacher.a@school-guntur-01.test",
    role: "teacher",
  },
  {
    labelEn: "Teacher B (School B — Vijayawada, Class 10-A)",
    labelTe: "ఉపాధ్యాయుడు B (పాఠశాల B — విజయవాడ, 10వ తరగతి-A)",
    email: "teacher.b@school-vijayawada-02.test",
    role: "teacher",
  },
  {
    labelEn: "School Admin (School A — Guntur)",
    labelTe: "పాఠశాల నిర్వాహకుడు (పాఠశాల A — గుంటూరు)",
    email: "schooladmin.a@school-guntur-01.test",
    role: "school_admin",
  },
  {
    labelEn: "District Admin (Guntur District)",
    labelTe: "జిల్లా నిర్వాహకుడు (గుంటూరు జిల్లా)",
    email: "district.guntur@ap-edu.test",
    role: "district_admin",
  },
  {
    labelEn: "State Admin",
    labelTe: "రాష్ట్ర నిర్వాహకుడు",
    email: "state.ap@ap-edu.test",
    role: "state_admin",
  },
  {
    labelEn: "Content Editor (Editorial Workflow)",
    labelTe: "కంటెంట్ ఎడిటర్ (పాఠ్యప్రణాళిక సవరణ)",
    email: "editor@g1virtualabs.test",
    role: "content_editor",
  },
  {
    labelEn: "Content Reviewer (Independent Two-Person Sign-Off)",
    labelTe: "కంటెంట్ సమీక్షకుడు (ఇద్దరు వ్యక్తుల స్వతంత్ర ఆమోదం)",
    email: "reviewer@g1virtualabs.test",
    role: "content_reviewer",
  },
];

export function SignInForm({
  locale,
  nextPath,
  roleHint,
  showSyntheticFixtures = false,
}: SignInFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState(
    showSyntheticFixtures && roleHint === "teacher"
      ? "teacher.a@school-guntur-01.test"
      : ""
  );
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTe = locale === "te-IN";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, password }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        authenticated?: boolean;
        redirectTo?: string;
        detail?: string;
      };

      if (!res.ok || !data.authenticated) {
        setError(
          data.detail ||
            (isTe
              ? "ఆ ఖాతా వివరాలతో సైన్ ఇన్ చేయడం సాధ్యం కాలేదు."
              : "Unable to sign in with those credentials.")
        );
        setSubmitting(false);
        return;
      }

      const safeNext =
        nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//") && !nextPath.includes("\\")
          ? nextPath
          : data.redirectTo || "/student";

      router.push(safeNext);
      router.refresh();
    } catch {
      setError(
        isTe
          ? "సైన్ ఇన్ చేసేటప్పుడు నెట్‌వర్క్ లోపం ఏర్పడింది."
          : "Network error while signing in."
      );
      setSubmitting(false);
    }
  }

  return (
    <div
      className={
        showSyntheticFixtures
          ? "grid grid-cols-1 gap-8 lg:grid-cols-12"
          : "mx-auto max-w-xl"
      }
    >
      <section
        aria-labelledby="signin-heading"
        className={`g1-card g1-signin-panel p-7 ${showSyntheticFixtures ? "lg:col-span-6" : ""}`}
      >
        <div className="g1-eyebrow">
          {isTe ? "పాఠశాల ఖాతా ప్రవేశం" : "School account sign-in"}
        </div>
        <h1
          id="signin-heading"
          className="mt-3 text-3xl font-extrabold tracking-tight text-[#0c2444]"
        >
          {isTe ? "G1 Virtual Labs లో సైన్ ఇన్ చేయండి" : "Sign in to G1 Virtual Labs"}
        </h1>
        <p className="mt-2 text-sm text-[#4b637a]">
          {isTe
            ? "మీ పాఠశాల లేదా కార్యక్రమం ఇచ్చిన ఖాతాతో సైన్ ఇన్ చేయండి."
            : "Use the account provided by your school or programme."}
        </p>

        {error && (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-[#fecdca] bg-[#fef3f2] px-4 py-3 text-sm font-semibold text-[#b42318]"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label
              htmlFor="signin-email"
              className="block text-sm font-bold text-[#133354]"
            >
              {roleHint === "creator" ? (isTe ? "సృష్టికర్త పేరు" : "Creator username") : (isTe ? "ఖాతా ఇమెయిల్" : "School account email")}
            </label>
            <input
              id="signin-email"
              name="email"
              type="text"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={
                showSyntheticFixtures && roleHint !== "creator"
                  ? "student.a@school-guntur-01.test"
                  : undefined
              }
              className="mt-1.5 h-12 w-full rounded-xl border border-[#7894aa] bg-[#f8fcff] px-4 text-sm text-[#0c2444]"
            />
          </div>

          <div>
            <label
              htmlFor="signin-password"
              className="block text-sm font-bold text-[#133354]"
            >
              {isTe ? "పాస్‌వర్డ్" : "Password"}
            </label>
            <input
              id="signin-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 h-12 w-full rounded-xl border border-[#7894aa] bg-[#f8fcff] px-4 text-sm text-[#0c2444]"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="g1-btn g1-btn-teal w-full min-h-[48px]"
            data-testid="signin-submit"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <KeyRound className="h-4 w-4" aria-hidden="true" />
            )}
            <span>{isTe ? "సైన్ ఇన్" : "Sign in"}</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>

        <Link className="g1-text-link mt-3" href={roleHint === "creator" ? "/sign-in" : "/sign-in?role=creator"}>
          {roleHint === "creator" ? (isTe ? "పాఠశాల ఖాతా సైన్ ఇన్" : "School account sign-in") : (isTe ? "సృష్టికర్త సైన్ ఇన్" : "Creator sign-in")}
        </Link>

        <div className="g1-hint mt-6 flex items-start gap-2.5">
          <ShieldCheck
            className="mt-0.5 h-4 w-4 shrink-0 text-[#007875]"
            aria-hidden="true"
          />
          <span>
            {isTe
              ? "సెషన్ కుకీలు HTTP-only మరియు server-verified RBAC తో రక్షించబడతాయి. నిజమైన విద్యార్థుల వ్యక్తిగత డేటా సేకరించబడదు."
              : "Sessions use server-verified HTTP-only cookies with CSRF protection and school-scoped role enforcement. No real student data is collected."}
          </span>
        </div>
      </section>

      {/* Transparent local synthetic test roster helper — strictly gated by ALLOW_LOCAL_SYNTHETIC_FIXTURES */}
      {showSyntheticFixtures && (
        <aside
          aria-labelledby="synthetic-roster-heading"
          className="g1-card p-7 lg:col-span-6"
          data-testid="synthetic-fixtures-panel"
        >
          <span className="g1-tag g1-tag-blue">
            {isTe ? "స్థానిక QA ఖాతాలు · సింథటిక్ మాత్రమే" : "Local QA Fixtures · Synthetic Only"}
          </span>
          <h2
            id="synthetic-roster-heading"
            className="mt-3 text-xl font-extrabold text-[#0c2444]"
          >
            {isTe ? "స్థానిక పరీక్షా ఖాతాలు" : "Seeded local synthetic accounts"}
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-[#4b637a]">
            {isTe
              ? "పాత్రల వేర్పాటు, రెండు-మోడ్‌ల ప్రయోగాలు, ఉపాధ్యాయ అసైన్‌మెంట్ ప్రచురణ మరియు సమీక్షా ఆమోదాన్ని పరీక్షించడానికి ఏదైనా స్థానిక ఖాతాను ఎంచుకోండి."
              : "Select any seeded local role below to prefill credentials for testing role isolation, two-mode launches, teacher assignment publishing, and editorial sign-off."}
          </p>

          <ul className="mt-4 divide-y divide-[#e8f0f5] rounded-2xl border border-[#ddebf3]">
            {SYNTHETIC_ACCOUNTS.map((acc) => (
              <li
                key={acc.email}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div>
                  <div className="text-xs font-extrabold text-[#0c2444]">
                    {isTe ? acc.labelTe : acc.labelEn}
                  </div>
                  <div className="font-mono text-[11px] text-[#4b637a]">{acc.email}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEmail(acc.email);
                    setPassword("G1LocalTest!2026");
                    setError(null);
                  }}
                  className="rounded-lg border border-[#7894aa] bg-white px-3 py-1.5 text-xs font-bold text-[#007875] hover:bg-[#eef8ff]"
                  data-testid={`fill-${acc.email}`}
                >
                  {isTe ? "ఖాతా నింపు" : "Use fixture"}
                </button>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
}
