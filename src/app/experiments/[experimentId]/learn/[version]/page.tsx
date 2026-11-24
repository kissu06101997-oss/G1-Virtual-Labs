import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { experimentReturnParams, type ExperimentReturnContext } from "@/lib/lab-discovery";
import { AppHeader } from "@/components/AppHeader";
import { LearningJourney } from "@/components/LearningJourney";
import { getCurrentSession, getRequestLocale } from "@/lib/auth";
import { getExperimentById } from "@/lib/catalog";
import { getExperimentCopy } from "@/lib/i18n";
import { getGuidedSession, getLearningContent, getLearningProgress } from "@/lib/learning";

export default async function LearningPage(props: {
  params: Promise<{ experimentId: string; version: string }>;
  searchParams: Promise<ExperimentReturnContext & { assignmentId?: string }>;
}) {
  const [{ experimentId, version }, search, auth, locale] = await Promise.all([
    props.params, props.searchParams, getCurrentSession(), getRequestLocale(),
  ]);
  const { assignmentId } = search;
  const browse = experimentReturnParams(search);
  const learningParams = new URLSearchParams(browse);
  if (typeof assignmentId === "string") learningParams.set("assignmentId", assignmentId);
  if (assignmentId && !z.uuid().safeParse(assignmentId).success) notFound();
  if (!auth) redirect("/sign-in?next=" + encodeURIComponent("/experiments/" + experimentId + "/learn/" + version +
    (learningParams.size ? "?" + learningParams : "")));
  if (auth.role !== "student" || !auth.schoolId || !auth.learnerId) notFound();
  const [exp, content, progress, guided] = await Promise.all([
    getExperimentById(experimentId, version),
    getLearningContent(experimentId, version),
    getLearningProgress(auth, experimentId, version),
    getGuidedSession(auth.schoolId, auth.learnerId, experimentId, version, assignmentId ?? null),
  ]);
  if (!exp || !content) notFound();

  const lang = locale === "te-IN" ? "te" : "en";
  return <>
    <AppHeader auth={auth} locale={locale} variant="student" />
    <LearningJourney browseQuery={browse.toString()} locale={locale} progress={progress} guided={guided}
      identity={{ experimentId, contentVersion: version, assignmentId: typeof assignmentId === "string" ? assignmentId : null,
        labId: exp.labId, manifestSha256: exp.manifestSha256, engineAbi: exp.engineAbi }}
      content={{
        title: content.title[lang], aim: content.aim[lang], theory: content.theory[lang],
        procedure: content.procedure.map(step => step[lang]), alternateMedia: content.alternateMedia[lang],
        videoId: content.videoId, thumbnailId: content.thumbnailId, result: content.result[lang],
        apparatus: {
          src: content.thumbnailId ? "/api/media/" + content.thumbnailId : getExperimentCopy(experimentId, locale, exp.subject).imagePath,
          alt: content.thumbnailAlt?.[lang] ?? (lang === "te" ? "పరికరాల నమూనా చిత్రం" : "Illustrative apparatus diagram"),
        },
        captions: (["en", "te"] as const).filter(language => content.captions?.[language]?.trim()),
        questions: content.questions.map(question => ({
          prompt: question.prompt[lang], options: question.options.map(option => option[lang]),
          ...(progress?.completed_stage === 5 ? { correct: question.correct, feedback: question.feedback[lang] } : {}),
        })),
      }} />

  </>;
}
