import { z } from "zod";

const text = z.string().trim().min(1).max(12000);
export const bilingualText = z.object({ en: text, te: text }).strict();
export const captionTracks = z.object({
  en: z.string().max(64000),
  te: z.string().max(64000),
}).strict();

function timedCaptions(value: string) {
  if (!value.trim()) return true;
  const clean = value.replace(/\r\n/g, "\n");
  return clean.startsWith("WEBVTT\n") && /^(?:\d{2}:)?\d{2}:\d{2}\.\d{3} --> (?:\d{2}:)?\d{2}:\d{2}\.\d{3}/m.test(clean);
}
export const assessmentQuestion = z.object({
  prompt: bilingualText,
  options: z.tuple([bilingualText, bilingualText, bilingualText, bilingualText]),
  correct: z.number().int().min(0).max(3),
  feedback: bilingualText,
}).strict().refine(question =>
  new Set(question.options.map(option => option.en.toLowerCase())).size === 4 &&
  new Set(question.options.map(option => option.te.toLowerCase())).size === 4,
  { message: "The four options must be distinct in both languages.", path: ["options"] },
);

export const learningContentSchema = z.object({
  title: bilingualText,
  description: bilingualText,
  aim: bilingualText,
  theory: bilingualText,
  procedure: z.array(bilingualText).min(1).max(30),
  alternateMedia: bilingualText,
  result: bilingualText,
  thumbnailId: z.uuid().nullable(),
  thumbnailAlt: bilingualText.nullable(),
  videoId: z.uuid().nullable(),
  captions: captionTracks.optional(),
  questions: z.tuple([assessmentQuestion, assessmentQuestion, assessmentQuestion, assessmentQuestion, assessmentQuestion]),
}).strict().refine(content => !content.thumbnailId || content.thumbnailAlt !== null,
  { message: "A thumbnail requires alt text in both languages.", path: ["thumbnailAlt"] })
  .refine(content => !content.captions || [content.captions.en, content.captions.te].every(timedCaptions),
    { message: "Provide valid WebVTT caption timestamps.", path: ["captions"] });

export const stageSubmission = z.discriminatedUnion("stage", [
  z.object({ stage: z.literal(1) }).strict(),
  z.object({ stage: z.literal(2) }).strict(),
  z.object({ stage: z.literal(3) }).strict(),
  z.object({ stage: z.literal(4) }).strict(),
  z.object({ stage: z.literal(5), answers: z.array(z.number().int().min(0).max(3)).length(5) }).strict(),
]);

export type LearningContent = z.infer<typeof learningContentSchema>;
