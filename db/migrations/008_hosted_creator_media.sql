ALTER TABLE creator_media
  ADD COLUMN blob_upload jsonb,
  ADD COLUMN blob_url text;
