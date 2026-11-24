import { z } from "zod";
import { captionTracks, learningContentSchema } from "./learning-contract";

const field = z.string().max(12000);
const pair = z.object({ en: field, te: field }).strict();
const draftQuestion = z.object({
  prompt: pair, options: z.tuple([pair, pair, pair, pair]),
  correct: z.number().int().min(0).max(3).nullable(), feedback: pair,
}).strict();
const uuid = z.uuid().nullable();
const formatId = z.string().max(96);
export const trustedLabManifestSchema = z.object({
  engine: z.enum(["chemistry", "biology", "physics"]),
  engineAbi: z.literal("lab@1"),
  sourceExperimentId: z.enum(["AP-CHEM-10-2.3", "AP-PHYS-10-9.10", "AP-BIO-09-5.1"]),
  sourceVersion: z.literal("0.1.0-research"),
  simulationEntry: z.literal("guided-player@1"),
  experimentEntry: z.literal("inquiry-player@1"),
  manifestSha256: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
export type TrustedLabManifest = z.infer<typeof trustedLabManifestSchema>;

export const draftSchema = z.object({
  slug: formatId, version: formatId, lessonId: formatId,
  additionalLessons: z.array(z.object({ grade: z.number().int().min(6).max(12), lessonId: formatId }).strict()).max(6).optional(),
  grade: z.number().int().min(6).max(12),
  subject: z.enum(["chemistry", "biology", "physics"]),
  activity: z.string().max(48),
  keywords: z.string().max(500),
  modelConfirmed: z.boolean(),
  labManifest: trustedLabManifestSchema.nullable().optional(),
  rightsConfirmed: z.boolean(),
  notes: z.string().max(500),
  learning: z.object({
    title: pair, description: pair, aim: pair, theory: pair, procedure: z.array(pair).max(30),
    alternateMedia: pair, result: pair, thumbnailId: uuid, thumbnailAlt: pair.nullable(), videoId: uuid, captions: captionTracks.optional(),
    questions: z.tuple([draftQuestion, draftQuestion, draftQuestion, draftQuestion, draftQuestion]),
  }).strict(),
}).strict();

export const submissionSchema = draftSchema.extend({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  version: z.string().regex(/^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-z0-9.-]+)?$/).max(44),
  lessonId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(96),
  activity: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9.-]{0,47}$/),
  learning: learningContentSchema.superRefine((content, ctx) => {
    if (!content.thumbnailId) ctx.addIssue({ code: "custom", path: ["thumbnailId"], message: "Choose a verified thumbnail." });
    if (content.title.en.length > 350 || content.title.te.length > 350) {
      ctx.addIssue({ code: "custom", path: ["title"], message: "Keep both titles to 350 characters." });
    }
  }),
  modelConfirmed: z.literal(true, { error: "Confirm the approved model and both entrypoints." }),
  rightsConfirmed: z.literal(true, { error: "Confirm ownership or licensed media rights." }),
  notes: z.string().trim().min(5, "Describe the content and science for the independent reviewer.").max(500),
});

export const lessonDraftSchema = z.object({
  code: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(70),
  subject: z.enum(["chemistry", "biology", "physics"]),
  grade: z.number().int().min(6).max(12),
  titleEn: z.string().trim().min(1).max(150),
  titleTe: z.string().trim().min(1).max(150),
  order: z.number().int().min(1).max(9999),
});

export const trustedLabBindings = {
  chemistry: { experimentId: "AP-CHEM-10-2.3", model: "CHEM-ZN-ACID-BOUND", name: "Zinc and dilute sulfuric acid" },
  physics: { experimentId: "AP-PHYS-10-9.10", model: "PHYS-SLAB-RAY", name: "Parallel glass slab refraction" },
  biology: { experimentId: "AP-BIO-09-5.1", model: "BIO-ONION-STACK", name: "Qualitative onion epidermis microscopy" },
} as const;

export type CreatorDraftBody = z.infer<typeof draftSchema>;

export function emptyCreatorDraft(): CreatorDraftBody {
  const pair = () => ({ en: "", te: "" });
  const question = (): CreatorDraftBody["learning"]["questions"][number] => ({
    prompt: pair(), options: [pair(), pair(), pair(), pair()], correct: null, feedback: pair(),
  });
  return {
    slug: "", version: "1.0.0", lessonId: "", additionalLessons: [], grade: 6, subject: "chemistry", activity: "", keywords: "",
    modelConfirmed: false, rightsConfirmed: false, notes: "", labManifest: null,
    learning: {
      title: pair(), description: pair(), aim: pair(), theory: pair(),
      procedure: [pair()], alternateMedia: pair(), result: pair(), thumbnailId: null, thumbnailAlt: pair(), videoId: null, captions: pair(),
      questions: [question(), question(), question(), question(), question()],
    },
  };
}
