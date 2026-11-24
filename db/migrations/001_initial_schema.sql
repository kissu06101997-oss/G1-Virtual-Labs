-- G1 Virtua Labs — Migration 001: Canonical Research PostgreSQL 16+ Schema + Local Platform Extensions
-- Base 35 DDL statements match specs/database_schema.sql directly.

CREATE TABLE IF NOT EXISTS schema_migration (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  CREATE TYPE lab_subject AS ENUM ('chemistry', 'physics', 'biology');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE lab_mode AS ENUM ('simulation', 'experiment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE principal_role AS ENUM (
    'student','teacher','school_admin','district_admin',
    'state_admin','content_editor','content_reviewer','operator'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS district (
  district_id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL
);

CREATE TABLE IF NOT EXISTS school (
  school_id uuid PRIMARY KEY,
  district_id uuid NOT NULL REFERENCES district,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  timezone text NOT NULL
);

CREATE TABLE IF NOT EXISTS principal (
  principal_id uuid PRIMARY KEY,
  broker_subject text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  preferred_locale text NOT NULL CHECK (preferred_locale IN ('en-IN','te-IN'))
);

CREATE TABLE IF NOT EXISTS principal_credential (
  principal_id uuid PRIMARY KEY REFERENCES principal ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  password_hash text NOT NULL,
  password_salt text NOT NULL,
  is_synthetic boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS role_grant (
  grant_id uuid PRIMARY KEY,
  principal_id uuid NOT NULL REFERENCES principal,
  role principal_role NOT NULL,
  school_id uuid REFERENCES school,
  district_id uuid REFERENCES district,
  revoked_at timestamptz,
  CHECK (
    (role IN ('student','teacher','school_admin') AND school_id IS NOT NULL AND district_id IS NULL)
    OR (role='district_admin' AND district_id IS NOT NULL AND school_id IS NULL)
    OR (role IN ('state_admin','content_editor','content_reviewer','operator') AND school_id IS NULL AND district_id IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS auth_session (
  session_token_hash char(64) PRIMARY KEY,
  principal_id uuid NOT NULL REFERENCES principal,
  active_role principal_role NOT NULL,
  active_school_id uuid REFERENCES school,
  active_district_id uuid REFERENCES district,
  csrf_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_learner (
  school_id uuid REFERENCES school,
  learner_id uuid,
  principal_id uuid NOT NULL REFERENCES principal,
  grade smallint NOT NULL CHECK (grade BETWEEN 6 AND 12),
  active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (school_id, learner_id),
  UNIQUE(school_id, principal_id)
);

CREATE TABLE IF NOT EXISTS classroom (
  school_id uuid REFERENCES school,
  class_id uuid,
  label text NOT NULL,
  grade smallint NOT NULL CHECK (grade BETWEEN 6 AND 12),
  PRIMARY KEY(school_id, class_id)
);

CREATE TABLE IF NOT EXISTS class_teacher (
  school_id uuid,
  class_id uuid,
  principal_id uuid REFERENCES principal,
  PRIMARY KEY(school_id, class_id, principal_id),
  FOREIGN KEY(school_id, class_id) REFERENCES classroom
);

CREATE TABLE IF NOT EXISTS enrollment (
  school_id uuid,
  class_id uuid,
  learner_id uuid,
  enrolled_at timestamptz NOT NULL,
  withdrawn_at timestamptz,
  PRIMARY KEY(school_id, class_id, learner_id),
  FOREIGN KEY(school_id, class_id) REFERENCES classroom,
  FOREIGN KEY(school_id, learner_id) REFERENCES school_learner
);

CREATE TABLE IF NOT EXISTS curriculum_ref (
  curriculum_id text PRIMARY KEY,
  source_id text NOT NULL,
  edition text NOT NULL,
  locator text NOT NULL,
  medium text NOT NULL
);

CREATE TABLE IF NOT EXISTS laboratory (
  subject lab_subject PRIMARY KEY,
  scene_family text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS experiment (
  experiment_id text PRIMARY KEY,
  subject lab_subject NOT NULL REFERENCES laboratory,
  UNIQUE(experiment_id, subject)
);

CREATE TABLE IF NOT EXISTS model_version (
  model_id text,
  version text,
  subject lab_subject NOT NULL REFERENCES laboratory,
  profile jsonb NOT NULL,
  model_digest char(64) NOT NULL,
  dataset_digest char(64),
  PRIMARY KEY(model_id, version),
  UNIQUE(model_id, version, subject)
);

CREATE TABLE IF NOT EXISTS experiment_version (
  experiment_id text,
  content_version text,
  subject lab_subject NOT NULL,
  manifest_digest char(64) NOT NULL,
  abi text NOT NULL,
  definition jsonb NOT NULL,
  published_at timestamptz,
  retired_at timestamptz,
  PRIMARY KEY(experiment_id, content_version),
  UNIQUE(experiment_id, content_version, subject),
  FOREIGN KEY(experiment_id, subject) REFERENCES experiment(experiment_id, subject)
);

CREATE TABLE IF NOT EXISTS experiment_curriculum (
  experiment_id text,
  content_version text,
  curriculum_id text REFERENCES curriculum_ref(curriculum_id),
  PRIMARY KEY(experiment_id, content_version, curriculum_id),
  FOREIGN KEY(experiment_id, content_version) REFERENCES experiment_version(experiment_id, content_version)
);

CREATE TABLE IF NOT EXISTS experiment_model (
  experiment_id text,
  content_version text,
  subject lab_subject,
  model_id text,
  model_version text,
  PRIMARY KEY(experiment_id, content_version, subject, model_id, model_version),
  FOREIGN KEY(experiment_id, content_version, subject) REFERENCES experiment_version(experiment_id, content_version, subject),
  FOREIGN KEY(model_id, model_version, subject) REFERENCES model_version(model_id, version, subject)
);

CREATE TABLE IF NOT EXISTS editorial_review (
  review_id uuid PRIMARY KEY,
  experiment_id text NOT NULL,
  content_version text NOT NULL,
  editor_principal_id uuid NOT NULL REFERENCES principal,
  reviewer_principal_id uuid REFERENCES principal,
  status text NOT NULL CHECK (status IN ('draft','submitted','approved','rework','revoked')),
  checklist jsonb NOT NULL,
  notes text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  CHECK (reviewer_principal_id IS NULL OR reviewer_principal_id <> editor_principal_id),
  FOREIGN KEY(experiment_id, content_version) REFERENCES experiment_version
);

CREATE TABLE IF NOT EXISTS assignment (
  school_id uuid,
  assignment_id uuid,
  class_id uuid NOT NULL,
  experiment_id text NOT NULL,
  content_version text NOT NULL,
  rubric_id text NOT NULL,
  locale_bundle_version text NOT NULL,
  due_at timestamptz,
  max_attempts integer NOT NULL CHECK(max_attempts > 0),
  created_by uuid REFERENCES principal,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(school_id, assignment_id),
  UNIQUE(school_id, assignment_id, class_id),
  UNIQUE(school_id, assignment_id, class_id, experiment_id, content_version),
  FOREIGN KEY(school_id, class_id) REFERENCES classroom,
  FOREIGN KEY(experiment_id, content_version) REFERENCES experiment_version
);

CREATE TABLE IF NOT EXISTS assignment_mode (
  school_id uuid,
  assignment_id uuid,
  mode lab_mode,
  PRIMARY KEY(school_id, assignment_id, mode),
  FOREIGN KEY(school_id, assignment_id) REFERENCES assignment
);

CREATE TABLE IF NOT EXISTS attempt (
  school_id uuid,
  attempt_id uuid,
  learner_id uuid NOT NULL,
  assignment_id uuid,
  class_id uuid,
  experiment_id text NOT NULL,
  content_version text NOT NULL,
  mode lab_mode NOT NULL,
  locale text NOT NULL DEFAULT 'en-IN' CHECK (locale IN ('en-IN','te-IN')),
  opened_at timestamptz NOT NULL,
  submitted_at timestamptz,
  CHECK ((assignment_id IS NULL) = (class_id IS NULL)),
  PRIMARY KEY(school_id, attempt_id),
  FOREIGN KEY(school_id, learner_id) REFERENCES school_learner,
  FOREIGN KEY(school_id, class_id, learner_id) REFERENCES enrollment,
  FOREIGN KEY(school_id, assignment_id, class_id, experiment_id, content_version)
    REFERENCES assignment(school_id, assignment_id, class_id, experiment_id, content_version),
  FOREIGN KEY(school_id, assignment_id, mode) REFERENCES assignment_mode,
  FOREIGN KEY(experiment_id, content_version) REFERENCES experiment_version
);

CREATE TABLE IF NOT EXISTS launch_grant (
  grant_digest char(64) PRIMARY KEY,
  school_id uuid NOT NULL,
  attempt_id uuid NOT NULL,
  audience text NOT NULL,
  expire_at timestamptz NOT NULL,
  redeemed_at timestamptz,
  FOREIGN KEY(school_id, attempt_id) REFERENCES attempt
);

CREATE TABLE IF NOT EXISTS lab_session (
  school_id uuid,
  session_id uuid,
  attempt_id uuid NOT NULL,
  revision bigint NOT NULL DEFAULT 0 CHECK(revision >= 0),
  state jsonb NOT NULL,
  status text NOT NULL CHECK(status IN ('active','paused','submitted','revoked')),
  saved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(school_id, session_id),
  UNIQUE(school_id, attempt_id),
  FOREIGN KEY(school_id, attempt_id) REFERENCES attempt
);

CREATE TABLE IF NOT EXISTS lab_action (
  school_id uuid,
  session_id uuid,
  committed_revision bigint CHECK(committed_revision > 0),
  idempotency_key text NOT NULL,
  request_digest char(64) NOT NULL,
  command jsonb NOT NULL,
  result jsonb NOT NULL,
  committed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(school_id, session_id, committed_revision),
  UNIQUE(school_id, session_id, idempotency_key),
  FOREIGN KEY(school_id, session_id) REFERENCES lab_session
);

CREATE TABLE IF NOT EXISTS observation (
  school_id uuid,
  session_id uuid,
  observation_id uuid,
  revision bigint NOT NULL,
  data jsonb NOT NULL,
  PRIMARY KEY(school_id, session_id, observation_id),
  FOREIGN KEY(school_id, session_id, revision) REFERENCES lab_action(school_id, session_id, committed_revision)
);

CREATE TABLE IF NOT EXISTS checkpoint (
  school_id uuid,
  session_id uuid,
  revision bigint CHECK(revision >= 0),
  digest char(64) NOT NULL,
  state jsonb NOT NULL,
  saved_at timestamptz NOT NULL,
  PRIMARY KEY(school_id, session_id, revision),
  FOREIGN KEY(school_id, session_id) REFERENCES lab_session
);

CREATE TABLE IF NOT EXISTS assessment (
  school_id uuid,
  attempt_id uuid,
  assessment_id uuid,
  rubric_version text NOT NULL,
  supersedes_id uuid,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY(school_id, attempt_id, assessment_id),
  FOREIGN KEY(school_id, attempt_id) REFERENCES attempt,
  FOREIGN KEY(school_id, attempt_id, supersedes_id) REFERENCES assessment
);

CREATE UNIQUE INDEX IF NOT EXISTS first_assessment_per_rubric
  ON assessment(school_id, attempt_id, rubric_version)
  WHERE supersedes_id IS NULL;

CREATE TABLE IF NOT EXISTS event_outbox (
  event_id uuid PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES school,
  event_type text NOT NULL,
  resource_key text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz
);

CREATE TABLE IF NOT EXISTS audit_event (
  event_id uuid PRIMARY KEY,
  school_id uuid REFERENCES school,
  action_type text NOT NULL,
  actor_id uuid REFERENCES principal,
  subject_digest char(64),
  occurred_at timestamptz NOT NULL,
  retention_class text NOT NULL
);

CREATE TABLE IF NOT EXISTS report_projection (
  school_id uuid,
  class_id uuid,
  assignment_id uuid,
  refreshed_at timestamptz NOT NULL,
  payload jsonb NOT NULL,
  PRIMARY KEY(school_id, class_id, assignment_id),
  FOREIGN KEY(school_id, class_id) REFERENCES classroom,
  FOREIGN KEY(school_id, assignment_id, class_id) REFERENCES assignment(school_id, assignment_id, class_id)
);

CREATE TABLE IF NOT EXISTS idempotency_record (
  scope text NOT NULL,
  idempotency_key text NOT NULL,
  request_digest char(64) NOT NULL,
  status_code integer NOT NULL,
  response_body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, idempotency_key)
);

CREATE TABLE IF NOT EXISTS school_device_profile (
  device_id uuid PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES school,
  label text NOT NULL,
  ram_gb integer NOT NULL,
  gpu_class text NOT NULL,
  webgl2_supported boolean NOT NULL,
  network_profile_mbps numeric(5,1) NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS attempt_lookup ON attempt(school_id, learner_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS assignment_class ON assignment(school_id, class_id, assignment_id);
CREATE INDEX IF NOT EXISTS outbox_pending ON event_outbox(created_at) WHERE delivered_at IS NULL;
CREATE INDEX IF NOT EXISTS audit_by_tenant_time ON audit_event(school_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS auth_session_principal ON auth_session(principal_id, expires_at DESC);
