-- Proposed PostgreSQL 16+ DDL. School-scoped rows use tenant composite keys.
-- Activate policy grants/RLS with non-owner runtime roles in deployment; zero deployments observed.
CREATE TYPE lab_subject AS ENUM ('chemistry', 'physics', 'biology');
CREATE TYPE lab_mode AS ENUM ('simulation', 'experiment');
CREATE TYPE principal_role AS ENUM ('student','teacher','school_admin','district_admin','state_admin','content_editor','content_reviewer','operator');

CREATE TABLE district (
  district_id uuid PRIMARY KEY, code text NOT NULL UNIQUE, name text NOT NULL
);
CREATE TABLE school (
  school_id uuid PRIMARY KEY, district_id uuid NOT NULL REFERENCES district, code text NOT NULL UNIQUE, timezone text NOT NULL
);
CREATE TABLE principal (
  principal_id uuid PRIMARY KEY, broker_subject text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT true, preferred_locale text NOT NULL CHECK (preferred_locale IN ('en-IN','te-IN'))
);
CREATE TABLE role_grant (
  grant_id uuid PRIMARY KEY, principal_id uuid NOT NULL REFERENCES principal, role principal_role NOT NULL,
  school_id uuid REFERENCES school, district_id uuid REFERENCES district, revoked_at timestamptz,
  CHECK (
    (role IN ('student','teacher','school_admin') AND school_id IS NOT NULL AND district_id IS NULL)
    OR (role='district_admin' AND district_id IS NOT NULL AND school_id IS NULL)
    OR (role IN ('state_admin','content_editor','content_reviewer','operator') AND school_id IS NULL AND district_id IS NULL)
  )
);
CREATE TABLE school_learner (
  school_id uuid REFERENCES school, learner_id uuid, principal_id uuid NOT NULL REFERENCES principal,
  grade smallint NOT NULL CHECK (grade BETWEEN 6 AND 12), active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (school_id, learner_id), UNIQUE(school_id, principal_id)
);
CREATE TABLE classroom (
  school_id uuid REFERENCES school, class_id uuid, label text NOT NULL,
  grade smallint NOT NULL CHECK (grade BETWEEN 6 AND 12), PRIMARY KEY(school_id, class_id)
);
CREATE TABLE class_teacher (
  school_id uuid, class_id uuid, principal_id uuid REFERENCES principal,
  PRIMARY KEY(school_id,class_id,principal_id), FOREIGN KEY(school_id,class_id) REFERENCES classroom
);
CREATE TABLE enrollment (
  school_id uuid, class_id uuid, learner_id uuid, enrolled_at timestamptz NOT NULL, withdrawn_at timestamptz,
  PRIMARY KEY(school_id,class_id,learner_id), FOREIGN KEY(school_id,class_id) REFERENCES classroom,
  FOREIGN KEY(school_id,learner_id) REFERENCES school_learner
);
CREATE TABLE curriculum_ref (
  curriculum_id text PRIMARY KEY, source_id text NOT NULL, edition text NOT NULL, locator text NOT NULL, medium text NOT NULL
);
CREATE TABLE laboratory (
  subject lab_subject PRIMARY KEY, scene_family text NOT NULL UNIQUE
);
CREATE TABLE experiment (
  experiment_id text PRIMARY KEY, subject lab_subject NOT NULL REFERENCES laboratory,
  UNIQUE(experiment_id,subject)
);
CREATE TABLE model_version (
  model_id text, version text, subject lab_subject NOT NULL REFERENCES laboratory,
  profile jsonb NOT NULL, model_digest char(64) NOT NULL, dataset_digest char(64),
  PRIMARY KEY(model_id,version), UNIQUE(model_id,version,subject)
);
CREATE TABLE experiment_version (
  experiment_id text, content_version text, subject lab_subject NOT NULL, manifest_digest char(64) NOT NULL,
  abi text NOT NULL, definition jsonb NOT NULL, published_at timestamptz, retired_at timestamptz,
  PRIMARY KEY(experiment_id,content_version), UNIQUE(experiment_id,content_version,subject),
  FOREIGN KEY(experiment_id,subject) REFERENCES experiment
);
CREATE TABLE experiment_curriculum (
  experiment_id text, content_version text, curriculum_id text REFERENCES curriculum_ref,
  PRIMARY KEY(experiment_id,content_version,curriculum_id), FOREIGN KEY(experiment_id,content_version) REFERENCES experiment_version
);
CREATE TABLE experiment_model (
  experiment_id text, content_version text, subject lab_subject, model_id text, model_version text,
  PRIMARY KEY(experiment_id,content_version,subject,model_id,model_version),
  FOREIGN KEY(experiment_id,content_version,subject) REFERENCES experiment_version,
  FOREIGN KEY(model_id,model_version,subject) REFERENCES model_version
);
CREATE TABLE assignment (
  school_id uuid, assignment_id uuid, class_id uuid NOT NULL, experiment_id text NOT NULL, content_version text NOT NULL,
  rubric_id text NOT NULL, locale_bundle_version text NOT NULL, due_at timestamptz, max_attempts integer NOT NULL CHECK(max_attempts>0),
  PRIMARY KEY(school_id,assignment_id), UNIQUE(school_id,assignment_id,class_id),
  UNIQUE(school_id,assignment_id,class_id,experiment_id,content_version),
  FOREIGN KEY(school_id,class_id) REFERENCES classroom,
  FOREIGN KEY(experiment_id,content_version) REFERENCES experiment_version
);
CREATE TABLE assignment_mode (
  school_id uuid, assignment_id uuid, mode lab_mode,
  PRIMARY KEY(school_id,assignment_id,mode), FOREIGN KEY(school_id,assignment_id) REFERENCES assignment
);
CREATE TABLE attempt (
  school_id uuid, attempt_id uuid, learner_id uuid NOT NULL, assignment_id uuid, class_id uuid, experiment_id text NOT NULL,
  content_version text NOT NULL, mode lab_mode NOT NULL, opened_at timestamptz NOT NULL, submitted_at timestamptz,
  CHECK ((assignment_id IS NULL) = (class_id IS NULL)), PRIMARY KEY(school_id,attempt_id),
  FOREIGN KEY(school_id,learner_id) REFERENCES school_learner,
  FOREIGN KEY(school_id,class_id,learner_id) REFERENCES enrollment,
  FOREIGN KEY(school_id,assignment_id,class_id,experiment_id,content_version) REFERENCES assignment(school_id,assignment_id,class_id,experiment_id,content_version),
  FOREIGN KEY(school_id,assignment_id,mode) REFERENCES assignment_mode,
  FOREIGN KEY(experiment_id,content_version) REFERENCES experiment_version
);
CREATE TABLE launch_grant (
  grant_digest char(64) PRIMARY KEY, school_id uuid NOT NULL, attempt_id uuid NOT NULL, audience text NOT NULL,
  expire_at timestamptz NOT NULL, redeemed_at timestamptz, FOREIGN KEY(school_id,attempt_id) REFERENCES attempt
);
CREATE TABLE lab_session (
  school_id uuid, session_id uuid, attempt_id uuid NOT NULL, revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
  state jsonb NOT NULL, status text NOT NULL CHECK(status IN ('active','paused','submitted','revoked')),
  PRIMARY KEY(school_id,session_id), UNIQUE(school_id,attempt_id), FOREIGN KEY(school_id,attempt_id) REFERENCES attempt
);
CREATE TABLE lab_action (
  school_id uuid, session_id uuid, committed_revision bigint CHECK(committed_revision>0),
  idempotency_key text NOT NULL, request_digest char(64) NOT NULL, command jsonb NOT NULL, result jsonb NOT NULL,
  committed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(school_id,session_id,committed_revision), UNIQUE(school_id,session_id,idempotency_key),
  FOREIGN KEY(school_id,session_id) REFERENCES lab_session
);
CREATE TABLE observation (
  school_id uuid, session_id uuid, observation_id uuid, revision bigint NOT NULL, data jsonb NOT NULL,
  PRIMARY KEY(school_id,session_id,observation_id),
  FOREIGN KEY(school_id,session_id,revision) REFERENCES lab_action(school_id,session_id,committed_revision)
);
CREATE TABLE checkpoint (
  school_id uuid, session_id uuid, revision bigint CHECK(revision>=0), digest char(64) NOT NULL,
  state jsonb NOT NULL, saved_at timestamptz NOT NULL, PRIMARY KEY(school_id,session_id,revision),
  FOREIGN KEY(school_id,session_id) REFERENCES lab_session
);
CREATE TABLE assessment (
  school_id uuid, attempt_id uuid, assessment_id uuid, rubric_version text NOT NULL,
  supersedes_id uuid, result jsonb NOT NULL, created_at timestamptz NOT NULL,
  PRIMARY KEY(school_id,attempt_id,assessment_id), FOREIGN KEY(school_id,attempt_id) REFERENCES attempt,
  FOREIGN KEY(school_id,attempt_id,supersedes_id) REFERENCES assessment
);
CREATE UNIQUE INDEX first_assessment_per_rubric ON assessment(school_id,attempt_id,rubric_version) WHERE supersedes_id IS NULL;
CREATE TABLE event_outbox (
  event_id uuid PRIMARY KEY, school_id uuid NOT NULL REFERENCES school, event_type text NOT NULL,
  resource_key text NOT NULL, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), delivered_at timestamptz
);
CREATE TABLE audit_event (
  event_id uuid PRIMARY KEY, school_id uuid REFERENCES school, action_type text NOT NULL,
  actor_id uuid REFERENCES principal, subject_digest char(64), occurred_at timestamptz NOT NULL, retention_class text NOT NULL
);
CREATE TABLE report_projection (
  school_id uuid, class_id uuid, assignment_id uuid, refreshed_at timestamptz NOT NULL, payload jsonb NOT NULL,
  PRIMARY KEY(school_id,class_id,assignment_id), FOREIGN KEY(school_id,class_id) REFERENCES classroom,
  FOREIGN KEY(school_id,assignment_id,class_id) REFERENCES assignment(school_id,assignment_id,class_id)
);
CREATE INDEX attempt_lookup ON attempt(school_id,learner_id,opened_at DESC);
CREATE INDEX assignment_class ON assignment(school_id,class_id,assignment_id);
CREATE INDEX outbox_pending ON event_outbox(created_at) WHERE delivered_at IS NULL;
CREATE INDEX audit_by_tenant_time ON audit_event(school_id,occurred_at DESC);
-- Expiry, school context proof, role/learner membership, personal data minimization and exact replay policy require service-layer integration tests.
