-- G1 Virtua Labs — Additive Upgrade Migration (W01–W13)
-- Preserves all baseline 001_initial_schema.sql contracts while adding:
-- 1. Per-mode rubric binding on assignment_mode (W02)
-- 2. Explicit overdue/late policy & immutable assignment revision lineage on assignment (W02 / G1-20)
-- 3. Explicit teacher preview & late attempt flags on attempt (W01 / G1-19 / G1-35)

ALTER TABLE assignment_mode
  ADD COLUMN IF NOT EXISTS rubric_id text;

ALTER TABLE assignment
  ADD COLUMN IF NOT EXISTS late_policy text NOT NULL DEFAULT 'allow_late_flagged'
    CHECK (late_policy IN ('allow_late_flagged', 'block_new_after_due')),
  ADD COLUMN IF NOT EXISTS revision_number integer NOT NULL DEFAULT 1
    CHECK (revision_number >= 1),
  ADD COLUMN IF NOT EXISTS supersedes_assignment_id uuid,
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz,
  ADD COLUMN IF NOT EXISTS revision_notes text;

ALTER TABLE attempt
  ADD COLUMN IF NOT EXISTS is_preview boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_late boolean NOT NULL DEFAULT false;

-- Backfill per-mode rubric_id on existing assignment_mode rows where null
UPDATE assignment_mode am
SET rubric_id = COALESCE(
  (
    SELECT ev.definition->'modeConfigurations'->(am.mode::text)->>'rubricId'
    FROM assignment a
    JOIN experiment_version ev
      ON ev.experiment_id = a.experiment_id
     AND ev.content_version = a.content_version
    WHERE a.school_id = am.school_id
      AND a.assignment_id = am.assignment_id
  ),
  (
    SELECT a.rubric_id
    FROM assignment a
    WHERE a.school_id = am.school_id
      AND a.assignment_id = am.assignment_id
  )
)
WHERE am.rubric_id IS NULL;
