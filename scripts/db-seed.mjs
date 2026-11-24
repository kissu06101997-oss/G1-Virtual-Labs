import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnvLocal();

const databaseUrl =
  process.env.DATABASE_URL || "postgres://postgres:postgres@127.0.0.1:54329/g1_virtua_labs";

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function canonicalJson(obj) {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + obj.map(canonicalJson).join(",") + "]";
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(obj[k])).join(",") + "}";
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

const SYNTHETIC_PASSWORD = "G1LocalTest!2026";

export const SEED_IDS = {
  districtGuntur: "d0000001-0000-4000-8000-000000000001",
  districtNtr: "d0000002-0000-4000-8000-000000000002",
  schoolA: "11111111-1111-4111-8111-111111111101",
  schoolB: "22222222-2222-4222-8222-222222222202",
  classA10A: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01",
  classA9A: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02",
  classB10A: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01",
  principals: {
    studentA: "p1000001-0000-4000-8000-000000000001".replace("p", "a"),
    studentA2: "a1000002-0000-4000-8000-000000000002",
    studentA3: "a1000003-0000-4000-8000-000000000003",
    studentA4: "a1000004-0000-4000-8000-000000000004",
    studentA5: "a1000005-0000-4000-8000-000000000005",
    studentA6: "a1000006-0000-4000-8000-000000000006",
    studentB: "b1000001-0000-4000-8000-000000000001",
    teacherA: "a2000001-0000-4000-8000-000000000001",
    teacherB: "b2000001-0000-4000-8000-000000000001",
    schoolAdminA: "a3000001-0000-4000-8000-000000000001",
    districtAdminGuntur: "d3000001-0000-4000-8000-000000000001",
    stateAdminAp: "e3000001-0000-4000-8000-000000000001",
    contactOperator: "e3000001-0000-4000-8000-000000000002",
    editor: "c1000001-0000-4000-8000-000000000001",
    reviewer: "c2000001-0000-4000-8000-000000000001",
  },
  learners: {
    studentA: "1a000001-0000-4000-8000-000000000001",
    studentA2: "1a000002-0000-4000-8000-000000000002",
    studentA3: "1a000003-0000-4000-8000-000000000003",
    studentA4: "1a000004-0000-4000-8000-000000000004",
    studentA5: "1a000005-0000-4000-8000-000000000005",
    studentA6: "1a000006-0000-4000-8000-000000000006",
    studentB: "1b000001-0000-4000-8000-000000000001",
  },
  assignments: {
    chemA10: "f0000001-0000-4000-8000-000000000001",
    physA10: "f0000002-0000-4000-8000-000000000002",
    bioA10: "f0000003-0000-4000-8000-000000000003",
    chemB10: "f0000004-0000-4000-8000-000000000004",
  },
  seedAttemptA: "70000001-0000-4000-8000-000000000001",
  seedSessionA: "80000001-0000-4000-8000-000000000001",
  seedAttemptA2: "70000002-0000-4000-8000-000000000002",
  seedSessionA2: "80000002-0000-4000-8000-000000000002",
};

export function buildExperimentDefinitions() {
  const specsDir = path.resolve(
    process.cwd(),
    "project-brief/AI_Virtual_Labs_Labster_REA_Research_2026-11/specs"
  );
  const chem = JSON.parse(fs.readFileSync(path.join(specsDir, "example_activity_2_3.json"), "utf8"));
  const phys = JSON.parse(fs.readFileSync(path.join(specsDir, "example_physics_experiment.json"), "utf8"));
  const bio = JSON.parse(fs.readFileSync(path.join(specsDir, "example_biology_experiment.json"), "utf8"));

  // Align Chemistry Activity 2.3 steps cleanly with the 5-step guided flow while preserving exact schema compliance
  chem.title = "Reaction of zinc with dilute sulfuric acid";
  chem.modeConfigurations.simulation.steps = [
    "Understand the aim",
    "Set up apparatus",
    "Add approved reactants",
    "Record observations",
    "Explain findings",
  ];
  chem.modeConfigurations.simulation.actionTypes = [
    "setup_apparatus",
    "identify_reagent",
    "propose_virtual_amount",
    "compare_observation",
  ];

  phys.modeConfigurations.simulation.steps = [
    "Understand the aim",
    "Mount parallel glass slab and normal",
    "Select incident ray angle",
    "Trace refracted and emergent rays",
    "Compare offset and explain findings",
  ];

  bio.modeConfigurations.simulation.steps = [
    "Understand the aim",
    "Select cleared onion epidermis slide",
    "Inspect acquired objective fields",
    "Mark visible cell wall boundary",
    "Record qualitative observation and limits",
  ];

  // Three clearly labeled curriculum-review preview cards from 02_Experiment_Catalogue.png
  const indicators = {
    experimentId: "AP-CHEM-10-2.1",
    labId: "chemistry",
    subject: "chemistry",
    title: "Acid–base indicators",
    grade: 10,
    curriculumReferences: [
      {
        sourceId: "AP-REF-10-PS",
        locator: "Chapter 2, Activity 2.1",
        editionStatus: "Curriculum edition and indicator reference curve pending review",
      },
    ],
    modeConfigurations: {
      simulation: {
        summary: "Guided indicator colour interpretation (pending curriculum & model review)",
        actionTypes: ["identify_reagent", "compare_observation"],
        steps: ["Identify indicator strips", "Observe colour shift", "Classify solution"],
        rubricId: "CHE-IND-GUIDED@1",
      },
      experiment: {
        summary: "Bounded comparison across approved reference solutions (pending approval)",
        actionTypes: ["identify_reagent", "compare_observation"],
        steps: ["Choose reference solution", "Compare indicator response", "Report classification"],
        rubricId: "CHE-IND-INQUIRY@1",
      },
    },
    sceneId: "room-chemistry@1",
    requiredApparatus: ["chem.indicator-rack", "chem.dropper"],
    allowedSubstances: ["litmus_reference"],
    initialInventory: [],
    supportedVariableRanges: {},
    scienceModelIds: ["CHEM-ZN-ACID-BOUND@0.1.0"],
    learningObjectives: ["Interpret qualitative indicator colour shifts in aqueous samples"],
    safetyRules: ["Virtual curriculum preview; not yet approved for student launch"],
    assessmentIds: ["CHE-IND-GUIDED@1", "CHE-IND-INQUIRY@1"],
    contentVersion: "0.1.0-draft",
    publicationStatus: "review_pending",
    datasetIds: [],
  };

  const circuits = {
    experimentId: "AP-PHYS-10-12.1",
    labId: "physics",
    subject: "physics",
    title: "Simple electric circuits",
    grade: 10,
    curriculumReferences: [
      {
        sourceId: "AP-REF-10-PS",
        locator: "Electricity, Circuit Activity",
        editionStatus: "Curriculum edition and DC KCL/KVL solver pending review",
      },
    ],
    modeConfigurations: {
      simulation: {
        summary: "Guided DC series circuit verification (pending solver sign-off)",
        actionTypes: ["place_optic"],
        steps: ["Connect cell and resistor", "Close switch", "Read ammeter and voltmeter"],
        rubricId: "PHY-CIR-GUIDED@1",
      },
      experiment: {
        summary: "Bounded resistance comparison (pending solver sign-off)",
        actionTypes: ["place_optic"],
        steps: ["Select admitted resistor", "Record current and voltage", "Check proportionality"],
        rubricId: "PHY-CIR-INQUIRY@1",
      },
    },
    sceneId: "room-physics@1",
    requiredApparatus: ["phys.cell", "phys.resistor", "phys.ammeter"],
    allowedSubstances: [],
    initialInventory: [],
    supportedVariableRanges: {},
    scienceModelIds: ["PHYS-SLAB-RAY@0.1.0"],
    learningObjectives: ["Relate potential difference and current in a bounded resistive circuit"],
    safetyRules: ["Virtual curriculum preview; not yet approved for student launch"],
    assessmentIds: ["PHY-CIR-GUIDED@1", "PHY-CIR-INQUIRY@1"],
    contentVersion: "0.1.0-draft",
    publicationStatus: "review_pending",
    datasetIds: [],
  };

  const plantStructures = {
    experimentId: "AP-BIO-08-2.1",
    labId: "biology",
    subject: "biology",
    title: "Plant structures and stomata",
    grade: 8,
    curriculumReferences: [
      {
        sourceId: "AP-REF-09-1",
        locator: "Plant Tissues, Stomata Observation",
        editionStatus: "Rights-cleared calibrated leaf peel micrographs pending review",
      },
    ],
    modeConfigurations: {
      simulation: {
        summary: "Guided plant tissue boundary observation (pending dataset clearance)",
        actionTypes: ["select_field"],
        steps: ["Select leaf peel slide", "Inspect guard cells", "Record qualitative observation"],
        rubricId: "BIO-PLT-GUIDED@1",
      },
      experiment: {
        summary: "Compare cleared plant fields (pending dataset clearance)",
        actionTypes: ["select_field"],
        steps: ["Compare two fields", "Note visible structures", "Record uncertainty"],
        rubricId: "BIO-PLT-INQUIRY@1",
      },
    },
    sceneId: "room-biology@1",
    requiredApparatus: ["bio.compound-microscope", "bio.prepared-leaf-slide"],
    allowedSubstances: ["cleared_prepared_plant_slide"],
    initialInventory: [],
    supportedVariableRanges: {},
    scienceModelIds: ["BIO-ONION-STACK@0.1.0"],
    learningObjectives: ["Compare recorded plant epidermis and stomatal structures"],
    safetyRules: ["Virtual curriculum preview; requires cleared micrograph dataset"],
    assessmentIds: ["BIO-PLT-GUIDED@1", "BIO-PLT-INQUIRY@1"],
    contentVersion: "0.1.0-draft",
    publicationStatus: "review_pending",
    datasetIds: [],
  };

  return [chem, phys, bio, indicators, circuits, plantStructures];
}

async function seed() {
  const host = new URL(databaseUrl).hostname;
  if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(host) || ["1", "true"].includes(process.env.VERCEL)) {
    throw new Error("Synthetic seeding requires a loopback database outside Vercel.");
  }
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("BEGIN");

    // 1. Districts & Schools
    await client.query(
      `INSERT INTO district (district_id, code, name) VALUES
        ($1, 'AP-GNT', 'Guntur District (Synthetic Pilot)'),
        ($2, 'AP-NTR', 'NTR Vijayawada District (Synthetic Pilot)')
       ON CONFLICT (district_id) DO NOTHING`,
      [SEED_IDS.districtGuntur, SEED_IDS.districtNtr]
    );

    await client.query(
      `INSERT INTO school (school_id, district_id, code, name, timezone) VALUES
        ($1, $3, 'AP-GNT-ZPHS-01', 'ZPHS Model School, Guntur (Synthetic)', 'Asia/Kolkata'),
        ($2, $4, 'AP-NTR-MHS-02', 'Municipal High School, Vijayawada (Synthetic)', 'Asia/Kolkata')
       ON CONFLICT (school_id) DO NOTHING`,
      [SEED_IDS.schoolA, SEED_IDS.schoolB, SEED_IDS.districtGuntur, SEED_IDS.districtNtr]
    );

    // 2. Classrooms
    await client.query(
      `INSERT INTO classroom (school_id, class_id, label, grade) VALUES
        ($1, $2, 'Class 10 — Section A', 10),
        ($1, $3, 'Class 9 — Section A', 9),
        ($4, $5, 'Class 10 — Section A', 10)
       ON CONFLICT (school_id, class_id) DO NOTHING`,
      [SEED_IDS.schoolA, SEED_IDS.classA10A, SEED_IDS.classA9A, SEED_IDS.schoolB, SEED_IDS.classB10A]
    );

    // 3. Synthetic Principals + Credentials + Role Grants
    const users = [
      { id: SEED_IDS.principals.studentA, email: "student.a@school-guntur-01.test", name: "Learner A-101 (Synthetic)", role: "student", schoolId: SEED_IDS.schoolA, districtId: null, locale: "en-IN", learnerId: SEED_IDS.learners.studentA, grade: 10, classId: SEED_IDS.classA10A },
      { id: SEED_IDS.principals.studentA2, email: "student.a2@school-guntur-01.test", name: "Learner A-102 (Synthetic)", role: "student", schoolId: SEED_IDS.schoolA, districtId: null, locale: "te-IN", learnerId: SEED_IDS.learners.studentA2, grade: 10, classId: SEED_IDS.classA10A },
      { id: SEED_IDS.principals.studentA3, email: "student.a3@school-guntur-01.test", name: "Learner A-103 (Synthetic)", role: "student", schoolId: SEED_IDS.schoolA, districtId: null, locale: "en-IN", learnerId: SEED_IDS.learners.studentA3, grade: 10, classId: SEED_IDS.classA10A },
      { id: SEED_IDS.principals.studentA4, email: "student.a4@school-guntur-01.test", name: "Learner A-104 (Synthetic)", role: "student", schoolId: SEED_IDS.schoolA, districtId: null, locale: "te-IN", learnerId: SEED_IDS.learners.studentA4, grade: 10, classId: SEED_IDS.classA10A },
      { id: SEED_IDS.principals.studentA5, email: "student.a5@school-guntur-01.test", name: "Learner A-105 (Synthetic)", role: "student", schoolId: SEED_IDS.schoolA, districtId: null, locale: "en-IN", learnerId: SEED_IDS.learners.studentA5, grade: 10, classId: SEED_IDS.classA10A },
      { id: SEED_IDS.principals.studentA6, email: "student.a6@school-guntur-01.test", name: "Learner A-106 (Synthetic)", role: "student", schoolId: SEED_IDS.schoolA, districtId: null, locale: "en-IN", learnerId: SEED_IDS.learners.studentA6, grade: 9, classId: SEED_IDS.classA9A },
      { id: SEED_IDS.principals.studentB, email: "student.b@school-vijayawada-02.test", name: "Learner B-201 (Synthetic)", role: "student", schoolId: SEED_IDS.schoolB, districtId: null, locale: "en-IN", learnerId: SEED_IDS.learners.studentB, grade: 10, classId: SEED_IDS.classB10A },
      { id: SEED_IDS.principals.teacherA, email: "teacher.a@school-guntur-01.test", name: "Teacher A — Physical Science (Synthetic)", role: "teacher", schoolId: SEED_IDS.schoolA, districtId: null, locale: "en-IN" },
      { id: SEED_IDS.principals.teacherB, email: "teacher.b@school-vijayawada-02.test", name: "Teacher B — Science (Synthetic)", role: "teacher", schoolId: SEED_IDS.schoolB, districtId: null, locale: "en-IN" },
      { id: SEED_IDS.principals.schoolAdminA, email: "schooladmin.a@school-guntur-01.test", name: "School Admin — Guntur ZPHS (Synthetic)", role: "school_admin", schoolId: SEED_IDS.schoolA, districtId: null, locale: "en-IN" },
      { id: SEED_IDS.principals.districtAdminGuntur, email: "district.guntur@ap-edu.test", name: "District Coordinator — Guntur (Synthetic)", role: "district_admin", schoolId: null, districtId: SEED_IDS.districtGuntur, locale: "en-IN" },
      { id: SEED_IDS.principals.stateAdminAp, email: "state.ap@ap-edu.test", name: "State Programme Reviewer — AP (Synthetic)", role: "state_admin", schoolId: null, districtId: null, locale: "en-IN" },
      { id: SEED_IDS.principals.contactOperator, email: "operator@g1virtualabs.test", name: "Contact Inbox Operator (Synthetic)", role: "operator", schoolId: null, districtId: null, locale: "en-IN" },
      { id: SEED_IDS.principals.editor, email: "editor@g1virtualabs.test", name: "Curriculum Content Editor (Synthetic)", role: "content_editor", schoolId: null, districtId: null, locale: "en-IN" },
      { id: SEED_IDS.principals.reviewer, email: "reviewer@g1virtualabs.test", name: "Independent Science Reviewer (Synthetic)", role: "content_reviewer", schoolId: null, districtId: null, locale: "en-IN" },
    ];

    for (const u of users) {
      await client.query(
        `INSERT INTO principal (principal_id, broker_subject, enabled, preferred_locale)
         VALUES ($1, $2, true, $3)
         ON CONFLICT (principal_id) DO NOTHING`,
        [u.id, `local-synthetic:${u.email}`, u.locale]
      );

      const salt = sha256Hex(`g1-synthetic-salt:${u.email}`).slice(0, 32);
      const pwHash = hashPassword(SYNTHETIC_PASSWORD, salt);
      await client.query(
        `INSERT INTO principal_credential (principal_id, email, display_name, password_hash, password_salt, is_synthetic)
         VALUES ($1, $2, $3, $4, $5, true)
         ON CONFLICT (principal_id) DO NOTHING`,
        [u.id, u.email, u.name, pwHash, salt]
      );

      const grantId = crypto
        .createHash("sha256")
        .update(`grant:${u.id}:${u.role}`)
        .digest("hex")
        .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12}).*$/, "$1-$2-4$3-8$4-$5")
        .slice(0, 36);
      // Use deterministic valid UUIDv4-formatted string
      const h = sha256Hex(`grant:${u.id}:${u.role}`);
      const validGrantUuid = `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;

      await client.query(
        `INSERT INTO role_grant (grant_id, principal_id, role, school_id, district_id)
         VALUES ($1, $2, $3::principal_role, $4, $5)
         ON CONFLICT (grant_id) DO NOTHING`,
        [validGrantUuid, u.id, u.role, u.schoolId, u.districtId]
      );

      if (u.learnerId && u.schoolId && u.classId) {
        await client.query(
          `INSERT INTO school_learner (school_id, learner_id, principal_id, grade, active)
           VALUES ($1, $2, $3, $4, true)
           ON CONFLICT (school_id, learner_id) DO NOTHING`,
          [u.schoolId, u.learnerId, u.id, u.grade]
        );
        await client.query(
          `INSERT INTO enrollment (school_id, class_id, learner_id, enrolled_at)
           VALUES ($1, $2, $3, '2026-06-15T09:00:00+05:30')
           ON CONFLICT (school_id, class_id, learner_id) DO NOTHING`,
          [u.schoolId, u.classId, u.learnerId]
        );
      }
    }

    // Assign Teacher A to School A Class 10-A ONLY (not Class 9-A, enabling same-school cross-class denial tests!)
    await client.query(
      `INSERT INTO class_teacher (school_id, class_id, principal_id) VALUES
        ($1, $2, $3),
        ($4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [
        SEED_IDS.schoolA,
        SEED_IDS.classA10A,
        SEED_IDS.principals.teacherA,
        SEED_IDS.schoolB,
        SEED_IDS.classB10A,
        SEED_IDS.principals.teacherB,
      ]
    );

    // 4. Laboratories, Curriculum Refs, Science Models & Experiments
    await client.query(
      `INSERT INTO laboratory (subject, scene_family) VALUES
        ('chemistry', 'room-chemistry@1'),
        ('physics', 'room-physics@1'),
        ('biology', 'room-biology@1')
       ON CONFLICT (subject) DO NOTHING`
    );

    await client.query(
      `INSERT INTO curriculum_ref (curriculum_id, source_id, edition, locator, medium) VALUES
        ('AP-CURR-10-CHEM-2.3', 'AP-REF-10-PS', 'Prior official edition; current 2026-27 confirmation pending', 'Activity 2.3, print 38, PDF 49', 'en-IN/te-IN'),
        ('AP-CURR-10-PHYS-9.10', 'AP-REF-10-PS', 'Prior official edition; current 2026-27 confirmation pending', 'Activity 9.10, print 184, PDF 195', 'en-IN/te-IN'),
        ('AP-CURR-09-BIO-5.1', 'AP-REF-09-1', 'Prior official edition; current 2026-27 confirmation pending', 'Activity 5.1, print 2-4, PDF 12-14', 'en-IN/te-IN')
       ON CONFLICT (curriculum_id) DO NOTHING`
    );

    const scienceModelsPath = path.resolve(process.cwd(), "specs/science_models.json");
    const scienceModels = JSON.parse(fs.readFileSync(scienceModelsPath, "utf8"));
    for (const model of scienceModels) {
      const digest = sha256Hex(canonicalJson(model));
      await client.query(
        `INSERT INTO model_version (model_id, version, subject, profile, model_digest, dataset_digest)
         VALUES ($1, $2, $3::lab_subject, $4::jsonb, $5, $6)
         ON CONFLICT (model_id, version) DO NOTHING`,
        [model.modelId, model.version, model.subject, JSON.stringify(model), digest, model.datasetSha256]
      );
    }

    const definitions = buildExperimentDefinitions();
    const currMap = {
      "AP-CHEM-10-2.3": "AP-CURR-10-CHEM-2.3",
      "AP-PHYS-10-9.10": "AP-CURR-10-PHYS-9.10",
      "AP-BIO-09-5.1": "AP-CURR-09-BIO-5.1",
    };

    for (const def of definitions) {
      const manifestDigest = sha256Hex(canonicalJson(def));
      const isPublished = def.publicationStatus === "research_fixture" || def.publicationStatus === "approved";

      await client.query(
        `INSERT INTO experiment (experiment_id, subject) VALUES ($1, $2::lab_subject)
         ON CONFLICT (experiment_id) DO NOTHING`,
        [def.experimentId, def.subject]
      );

      await client.query(
        `INSERT INTO experiment_version
          (experiment_id, content_version, subject, manifest_digest, abi, definition, published_at)
         VALUES ($1, $2, $3::lab_subject, $4, 'lab@1', $5::jsonb, $6)
         ON CONFLICT (experiment_id, content_version) DO UPDATE
           SET definition = EXCLUDED.definition, manifest_digest = EXCLUDED.manifest_digest`,
        [
          def.experimentId,
          def.contentVersion,
          def.subject,
          manifestDigest,
          JSON.stringify(def),
          isPublished ? "2026-11-22T09:00:00+05:30" : null,
        ]
      );

      if (currMap[def.experimentId]) {
        await client.query(
          `INSERT INTO experiment_curriculum (experiment_id, content_version, curriculum_id)
           VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [def.experimentId, def.contentVersion, currMap[def.experimentId]]
        );
      }

      for (const mRef of def.scienceModelIds) {
        const [mId, mVer] = mRef.split("@");
        await client.query(
          `INSERT INTO experiment_model (experiment_id, content_version, subject, model_id, model_version)
           VALUES ($1, $2, $3::lab_subject, $4, $5) ON CONFLICT DO NOTHING`,
          [def.experimentId, def.contentVersion, def.subject, mId, mVer]
        );
      }
    }

    await client.query(`
      INSERT INTO experiment_lesson (experiment_id, content_version, subject, grade, lesson_id, activity_number)
      SELECT ev.experiment_id, ev.content_version, ev.subject, lesson.grade, lesson.lesson_id, map.activity
      FROM experiment_version ev
      JOIN (VALUES ('AP-CHEM-10-2.3','acids-bases-salts','2.3'),
                   ('AP-BIO-09-5.1','fundamental-unit-of-life','5.1'),
                   ('AP-PHYS-10-9.10','light-reflection-refraction','9.10'))
        AS map(experiment_id, lesson_id, activity) ON ev.experiment_id = map.experiment_id
      JOIN lab_lesson lesson ON lesson.lesson_id = map.lesson_id
      WHERE ev.content_version = '0.1.0-research'
      ON CONFLICT DO NOTHING`);

    // Editorial reviews showing two-person review state
    await client.query(
      `INSERT INTO editorial_review
        (review_id, experiment_id, content_version, editor_principal_id, reviewer_principal_id, status, checklist, notes, reviewed_at)
       VALUES
        ('91000001-0000-4000-8000-000000000001', 'AP-CHEM-10-2.3', '0.1.0-research', $1, $2, 'approved',
         '{"editionVerified":false,"bilingualChecked":true,"safetyReviewed":true,"modelBounded":true,"rightsCleared":true}'::jsonb,
         'Approved as research_fixture for Gate W website pilot; current 2026-27 AP edition binding remains pending formal SCERT confirmation.',
         '2026-11-22T09:30:00+05:30'),
        ('91000002-0000-4000-8000-000000000002', 'AP-CHEM-10-2.1', '0.1.0-draft', $1, NULL, 'submitted',
         '{"editionVerified":false,"bilingualChecked":false,"safetyReviewed":true,"modelBounded":false,"rightsCleared":true}'::jsonb,
         'Awaiting independent science reviewer sign-off and indicator curve qualification.',
         NULL)
       ON CONFLICT (review_id) DO NOTHING`,
      [SEED_IDS.principals.editor, SEED_IDS.principals.reviewer]
    );

    // 5. Initial Assignments (School A Class 10-A & School B Class 10-A)
    await client.query(
      `INSERT INTO assignment
        (school_id, assignment_id, class_id, experiment_id, content_version, rubric_id, locale_bundle_version, due_at, max_attempts, created_by)
       VALUES
        ($1, $2, $3, 'AP-CHEM-10-2.3', '0.1.0-research', 'CHE-GUIDED@1', 'locale-en-te@1.0.0', '2026-12-10T17:00:00+05:30', 3, $7),
        ($1, $4, $3, 'AP-PHYS-10-9.10', '0.1.0-research', 'PHY-INQUIRY@1', 'locale-en-te@1.0.0', '2026-12-15T17:00:00+05:30', 3, $7),
        ($1, $5, $3, 'AP-BIO-09-5.1', '0.1.0-research', 'BIO-GUIDED@1', 'locale-en-te@1.0.0', '2026-12-20T17:00:00+05:30', 3, $7),
        ($8, $6, $9, 'AP-CHEM-10-2.3', '0.1.0-research', 'CHE-GUIDED@1', 'locale-en-te@1.0.0', '2026-12-12T17:00:00+05:30', 3, $10)
       ON CONFLICT (school_id, assignment_id) DO NOTHING`,
      [
        SEED_IDS.schoolA,
        SEED_IDS.assignments.chemA10,
        SEED_IDS.classA10A,
        SEED_IDS.assignments.physA10,
        SEED_IDS.assignments.bioA10,
        SEED_IDS.assignments.chemB10,
        SEED_IDS.principals.teacherA,
        SEED_IDS.schoolB,
        SEED_IDS.classB10A,
        SEED_IDS.principals.teacherB,
      ]
    );

    const assignmentModes = [
      [SEED_IDS.schoolA, SEED_IDS.assignments.chemA10, "simulation"],
      [SEED_IDS.schoolA, SEED_IDS.assignments.chemA10, "experiment"],
      [SEED_IDS.schoolA, SEED_IDS.assignments.physA10, "experiment"],
      [SEED_IDS.schoolA, SEED_IDS.assignments.physA10, "simulation"],
      [SEED_IDS.schoolA, SEED_IDS.assignments.bioA10, "simulation"],
      [SEED_IDS.schoolA, SEED_IDS.assignments.bioA10, "experiment"],
      [SEED_IDS.schoolB, SEED_IDS.assignments.chemB10, "simulation"],
    ];
    for (const [sid, aid, mode] of assignmentModes) {
      await client.query(
        `INSERT INTO assignment_mode (school_id, assignment_id, mode)
         VALUES ($1, $2, $3::lab_mode) ON CONFLICT DO NOTHING`,
        [sid, aid, mode]
      );
    }

    // 6. Seed one active resumable Simulation Mode attempt for student.a (Step 2 of 5, revision 1)
    const initialChemState = {
      stepIndex: 1,
      totalSteps: 5,
      completedSteps: [0],
      apparatusConnected: false,
      reagentsIdentified: ["Zn", "dilute_H2SO4"],
      zincUmol: 2.0,
      acidEqUmol: 3.0,
      controlTrial: null,
      comparisonTrial: null,
      claimNote: "",
      visualCues: ["aim-reviewed"],
    };
    const stateDigest1 = sha256Hex(canonicalJson(initialChemState));

    await client.query(
      `INSERT INTO attempt
        (school_id, attempt_id, learner_id, assignment_id, class_id, experiment_id, content_version, mode, locale, opened_at)
       VALUES ($1, $2, $3, $4, $5, 'AP-CHEM-10-2.3', '0.1.0-research', 'simulation', 'en-IN', '2026-11-22T09:40:00+05:30')
       ON CONFLICT (school_id, attempt_id) DO NOTHING`,
      [
        SEED_IDS.schoolA,
        SEED_IDS.seedAttemptA,
        SEED_IDS.learners.studentA,
        SEED_IDS.assignments.chemA10,
        SEED_IDS.classA10A,
      ]
    );

    await client.query(
      `INSERT INTO lab_session
        (school_id, session_id, attempt_id, revision, state, status, saved_at)
       VALUES ($1, $2, $3, 1, $4::jsonb, 'active', '2026-11-22T09:45:00+05:30')
       ON CONFLICT (school_id, session_id) DO NOTHING`,
      [SEED_IDS.schoolA, SEED_IDS.seedSessionA, SEED_IDS.seedAttemptA, JSON.stringify(initialChemState)]
    );

    await client.query(
      `INSERT INTO checkpoint (school_id, session_id, revision, digest, state, saved_at)
       VALUES ($1, $2, 1, $3, $4::jsonb, '2026-11-22T09:45:00+05:30')
       ON CONFLICT (school_id, session_id, revision) DO NOTHING`,
      [SEED_IDS.schoolA, SEED_IDS.seedSessionA, stateDigest1, JSON.stringify(initialChemState)]
    );

    // 7. Seed one completed & graded synthetic submission for student.a2 so Teacher A report has real PostgreSQL data
    const completedState = {
      stepIndex: 4,
      totalSteps: 5,
      completedSteps: [0, 1, 2, 3, 4],
      apparatusConnected: true,
      reagentsIdentified: ["Zn", "dilute_H2SO4"],
      zincUmol: 2.0,
      acidEqUmol: 3.0,
      theoreticalH2Umol: 1.5,
      excessZnUmol: 0.5,
      claimNote: "Zinc reacts with dilute sulfuric acid releasing gas bubbles routed into soap solution; theoretical H2 upper bound is 1.5 umol.",
      visualCues: ["apparatus-connected", "bubbles-soap-solution"],
    };
    const obsIdA2 = "55000001-0000-4000-8000-000000000001";
    const assessmentIdA2 = "66000001-0000-4000-8000-000000000001";
    const completedDigest = sha256Hex(canonicalJson(completedState));

    await client.query(
      `INSERT INTO attempt
        (school_id, attempt_id, learner_id, assignment_id, class_id, experiment_id, content_version, mode, locale, opened_at, submitted_at)
       VALUES ($1, $2, $3, $4, $5, 'AP-CHEM-10-2.3', '0.1.0-research', 'simulation', 'te-IN', '2026-11-21T10:00:00+05:30', '2026-11-21T10:18:00+05:30')
       ON CONFLICT (school_id, attempt_id) DO NOTHING`,
      [
        SEED_IDS.schoolA,
        SEED_IDS.seedAttemptA2,
        SEED_IDS.learners.studentA2,
        SEED_IDS.assignments.chemA10,
        SEED_IDS.classA10A,
      ]
    );

    await client.query(
      `INSERT INTO lab_session
        (school_id, session_id, attempt_id, revision, state, status, saved_at)
       VALUES ($1, $2, $3, 1, $4::jsonb, 'submitted', '2026-11-21T10:18:00+05:30')
       ON CONFLICT (school_id, session_id) DO NOTHING`,
      [SEED_IDS.schoolA, SEED_IDS.seedSessionA2, SEED_IDS.seedAttemptA2, JSON.stringify(completedState)]
    );

    await client.query(
      `INSERT INTO lab_action
        (school_id, session_id, committed_revision, idempotency_key, request_digest, command, result, committed_at)
       VALUES ($1, $2, 1, 'seed-action-a2-rev1', $3, $4::jsonb, $5::jsonb, '2026-11-21T10:15:00+05:30')
       ON CONFLICT (school_id, session_id, committed_revision) DO NOTHING`,
      [
        SEED_IDS.schoolA,
        SEED_IDS.seedSessionA2,
        sha256Hex("seed-action-a2-rev1"),
        JSON.stringify({ actionType: "propose_virtual_amount", targetObjectId: "chem.reaction-tube:1" }),
        JSON.stringify({ accepted: true, reasonCode: "OK", committedRevision: 1 }),
      ]
    );

    await client.query(
      `INSERT INTO observation (school_id, session_id, observation_id, revision, data)
       VALUES ($1, $2, $3, 1, $4::jsonb)
       ON CONFLICT (school_id, session_id, observation_id) DO NOTHING`,
      [
        SEED_IDS.schoolA,
        SEED_IDS.seedSessionA2,
        obsIdA2,
        JSON.stringify({
          observationId: obsIdA2,
          metric: "theoretical_h2_upper_bound",
          value: { value: 1.5, unit: "umol" },
          uncertainty: { kind: "unknown", lower: null, upper: null, note: "Ideal stoichiometric upper bound; physical yield and rate unknown." },
        }),
      ]
    );

    await client.query(
      `INSERT INTO checkpoint (school_id, session_id, revision, digest, state, saved_at)
       VALUES ($1, $2, 1, $3, $4::jsonb, '2026-11-21T10:18:00+05:30')
       ON CONFLICT (school_id, session_id, revision) DO NOTHING`,
      [SEED_IDS.schoolA, SEED_IDS.seedSessionA2, completedDigest, JSON.stringify(completedState)]
    );

    await client.query(
      `INSERT INTO assessment (school_id, attempt_id, assessment_id, rubric_version, result, created_at)
       VALUES ($1, $2, $3, 'CHE-GUIDED@1', $4::jsonb, '2026-11-21T10:18:00+05:30')
       ON CONFLICT (school_id, attempt_id, assessment_id) DO NOTHING`,
      [
        SEED_IDS.schoolA,
        SEED_IDS.seedAttemptA2,
        assessmentIdA2,
        JSON.stringify({
          submissionId: assessmentIdA2,
          attemptId: SEED_IDS.seedAttemptA2,
          gradeState: "committed",
          rubricId: "CHE-GUIDED@1",
          evidenceIds: [obsIdA2],
          criteriaPassed: 4,
          criteriaTotal: 4,
          summary: "Confirmed apparatus setup, approved reactants, bounded observation and qualitative explanation.",
        }),
      ]
    );

    // 8. School device readiness metadata (synthetic hardware audit inventory)
    await client.query(
      `INSERT INTO school_device_profile (device_id, school_id, label, ram_gb, gpu_class, webgl2_supported, network_profile_mbps)
       VALUES
        ('d1000001-0000-4000-8000-000000000001', $1, 'Classroom Lab PC — 4 GB Integrated', 4, 'Intel UHD Integrated', true, 5.0),
        ('d1000002-0000-4000-8000-000000000002', $1, 'Science Teacher Laptop — 8 GB', 8, 'Integrated Graphics', true, 20.0),
        ('d1000003-0000-4000-8000-000000000003', $1, 'Low-Bandwidth Rural Tablet — 2D DOM Route', 4, 'Mobile GPU (2D DOM Fallback)', true, 1.1)
       ON CONFLICT (device_id) DO NOTHING`,
      [SEED_IDS.schoolA]
    );

    await client.query(
      `INSERT INTO audit_event (event_id, school_id, action_type, actor_id, subject_digest, occurred_at, retention_class)
       VALUES
        ('e9000001-0000-4000-8000-000000000001', $1, 'seed.initialized', $2, $3, '2026-11-22T09:00:00+05:30', 'operational_short')
       ON CONFLICT (event_id) DO NOTHING`,
      [SEED_IDS.schoolA, SEED_IDS.principals.schoolAdminA, sha256Hex("seed-init")]
    );

    await client.query("COMMIT");
    console.log("[db:seed] Seeded synthetic AP districts, schools, classes, learners, teachers, admins, experiments and fixtures.");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    await client.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  seed().catch((err) => {
    console.error("[db:seed] Failed:", err);
    process.exit(1);
  });
}
