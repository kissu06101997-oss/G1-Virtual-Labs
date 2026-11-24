import { GlassBack } from "@/components/GlassBack";
import { AppHeader } from "@/components/AppHeader";
import { SignInForm } from "@/components/SignInForm";
import { getCurrentSession, getRequestLocale } from "@/lib/auth";

export default async function SignInPage(props: {
  searchParams: Promise<{ next?: string; role?: string }>;
}) {
  const [auth, locale, sp] = await Promise.all([
    getCurrentSession(),
    getRequestLocale(),
    props.searchParams,
  ]);

  const showSyntheticFixtures = process.env.ALLOW_LOCAL_SYNTHETIC_FIXTURES === "true";

  return (
    <>
      <AppHeader variant="public" locale={locale} auth={auth} />
      <main id="main-content" className="g1-premium g1-signin-shell mx-auto w-full max-w-[1280px] flex-1 px-4 py-10 sm:px-8 lg:px-14">
        <GlassBack href="/" label={locale === "te-IN" ? "ముఖపుటకు తిరిగి" : "Back to home"} />
        <SignInForm
          locale={locale}
          nextPath={sp.next}
          roleHint={sp.role}
          showSyntheticFixtures={showSyntheticFixtures}
        />
      </main>

    </>
  );
}
