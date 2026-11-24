ALTER TABLE experiment_lesson ADD COLUMN is_primary boolean NOT NULL DEFAULT true;
CREATE UNIQUE INDEX experiment_one_primary_lesson
  ON experiment_lesson(experiment_id, content_version) WHERE is_primary;
