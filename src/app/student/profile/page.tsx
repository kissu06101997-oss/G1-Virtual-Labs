import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { StudentAccountNav } from "@/components/StudentAccountNav";
import { StudentProfileForm } from "@/components/StudentProfileForm";
import { getCurrentSession, getRequestLocale } from "@/lib/auth";

export default async function StudentProfilePage() {
  const [auth, locale] = await Promise.all([getCurrentSession(), getRequestLocale()]);
  if (!auth) redirect("/sign-in?next=/student/profile&role=student");
  if (auth.role !== "student" || !auth.schoolId || !auth.learnerId) notFound();

  const te = locale === "te-IN";
  return (
    <>
      <AppHeader variant="student" locale={locale} auth={auth} />
      <main id="main-content" className="g1-premium mx-auto w-full max-w-[1100px] flex-1 px-4 py-8 sm:px-8 lg:px-10">
        <StudentAccountNav locale={locale} current="profile" />
        <section className="g1-card max-w-2xl p-5 sm:p-8" aria-labelledby="student-profile-title">
          <h1 id="student-profile-title" className="text-3xl font-extrabold tracking-tight text-[#0c2444]">
            {te ? "విద్యార్థి ప్రొఫైల్" : "Student profile"}
          </h1>
          <StudentProfileForm locale={locale} displayName={auth.displayName} />
          <dl className="mt-6 grid gap-4 border-t border-[#cbdde8] pt-5 text-sm sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="font-bold text-[#0c2444]">{te ? "సైన్ ఇన్ ఖాతా" : "Sign-in account"}</dt>
              <dd className="mt-1 break-all text-[#38546c]">{auth.email}</dd>
            </div>
            <div className="min-w-0">
              <dt className="font-bold text-[#0c2444]">{te ? "పాఠశాల" : "School"}</dt>
              <dd className="mt-1 break-words text-[#38546c]">{auth.schoolName}</dd>
            </div>
          </dl>
        </section>
      </main>
    </>
  );
}
