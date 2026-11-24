ALTER TABLE school_learner
  ADD COLUMN profile_display_name text
  CHECK (char_length(profile_display_name) BETWEEN 1 AND 100);
