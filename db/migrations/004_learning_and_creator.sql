ALTER TABLE role_grant DROP CONSTRAINT role_grant_check;
ALTER TABLE role_grant ADD CONSTRAINT role_grant_check CHECK (
  (role IN ('student','teacher','school_admin') AND school_id IS NOT NULL AND district_id IS NULL)
  OR (role = 'district_admin' AND district_id IS NOT NULL AND school_id IS NULL)
  OR (role IN ('state_admin','content_editor','content_reviewer','operator','creator')
    AND school_id IS NULL AND district_id IS NULL)
);

CREATE TABLE lab_lesson (
  lesson_id text PRIMARY KEY,
  subject lab_subject NOT NULL REFERENCES laboratory,
  grade smallint NOT NULL CHECK (grade BETWEEN 6 AND 12),
  title_en text NOT NULL,
  title_te text NOT NULL,
  curriculum_order smallint NOT NULL CHECK (curriculum_order > 0),
  owner_principal_id uuid REFERENCES principal,
  published_at timestamptz,
  UNIQUE (lesson_id, subject, grade)
);

INSERT INTO laboratory (subject, scene_family) VALUES
  ('chemistry', 'room-chemistry@1'),
  ('physics', 'room-physics@1'),
  ('biology', 'room-biology@1')
ON CONFLICT (subject) DO NOTHING;

INSERT INTO lab_lesson (lesson_id, subject, grade, title_en, title_te, curriculum_order, published_at)
VALUES
  ('acids-bases-salts', 'chemistry', 10, 'Acids, bases and salts', 'ఆమ్లాలు, క్షారాలు మరియు లవణాలు', 2, now()),
  ('fundamental-unit-of-life', 'biology', 9, 'The fundamental unit of life', 'జీవం యొక్క ప్రాథమిక ప్రమాణం', 5, now()),
  ('light-reflection-refraction', 'physics', 10, 'Light reflection and refraction', 'కాంతి పరావర్తనం మరియు వక్రీభవనం', 9, now());

CREATE TABLE experiment_lesson (
  experiment_id text NOT NULL,
  content_version text NOT NULL,
  subject lab_subject NOT NULL,
  grade smallint NOT NULL,
  lesson_id text NOT NULL,
  activity_number text NOT NULL,
  PRIMARY KEY (experiment_id, content_version, lesson_id),
  FOREIGN KEY (experiment_id, content_version, subject) REFERENCES experiment_version (experiment_id, content_version, subject),
  FOREIGN KEY (lesson_id, subject, grade) REFERENCES lab_lesson (lesson_id, subject, grade)
);

INSERT INTO experiment_lesson (experiment_id, content_version, subject, grade, lesson_id, activity_number)
SELECT ev.experiment_id, ev.content_version, ev.subject, lesson.grade, lesson.lesson_id, map.activity
FROM experiment_version ev
JOIN (VALUES ('AP-CHEM-10-2.3','acids-bases-salts','2.3'),
             ('AP-BIO-09-5.1','fundamental-unit-of-life','5.1'),
             ('AP-PHYS-10-9.10','light-reflection-refraction','9.10'))
  AS map(experiment_id, lesson_id, activity) ON ev.experiment_id = map.experiment_id
JOIN lab_lesson lesson ON lesson.lesson_id = map.lesson_id;

CREATE TABLE creator_draft (
  draft_id uuid PRIMARY KEY,
  owner_principal_id uuid NOT NULL REFERENCES principal,
  body jsonb NOT NULL,
  revision int NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  review_id uuid REFERENCES editorial_review,
  UNIQUE (review_id)
);

CREATE TABLE creator_media (
  asset_id uuid PRIMARY KEY,
  owner_principal_id uuid NOT NULL REFERENCES principal,
  filename text NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('image/png','image/jpeg','image/webp','video/mp4','video/webm')),
  expected_bytes bigint NOT NULL CHECK (expected_bytes > 0),
  status text NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading','ready','failed','canceled')),
  sha256 char(64),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE learning_version (
  experiment_id text NOT NULL,
  content_version text NOT NULL,
  content jsonb NOT NULL,
  PRIMARY KEY (experiment_id, content_version),
  FOREIGN KEY (experiment_id, content_version) REFERENCES experiment_version (experiment_id, content_version)
);

CREATE TABLE learning_progress (
  school_id uuid NOT NULL,
  learner_id uuid NOT NULL,
  experiment_id text NOT NULL,
  content_version text NOT NULL,
  completed_stage smallint NOT NULL DEFAULT 0 CHECK (completed_stage BETWEEN 0 AND 5),
  answers jsonb,
  score smallint CHECK (score BETWEEN 0 AND 5),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (school_id, learner_id, experiment_id, content_version),
  FOREIGN KEY (school_id, learner_id) REFERENCES school_learner,
  FOREIGN KEY (experiment_id, content_version) REFERENCES learning_version,
  CHECK ((completed_stage = 5) = (completed_at IS NOT NULL)),
  CHECK ((completed_stage = 5) = (answers IS NOT NULL AND score IS NOT NULL))
);

CREATE INDEX learning_progress_recent ON learning_progress (school_id, learner_id, updated_at DESC);
