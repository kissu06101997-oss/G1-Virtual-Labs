CREATE TABLE contact_inquiry (
  inquiry_id uuid PRIMARY KEY,
  fingerprint text NOT NULL UNIQUE,
  received_at timestamptz NOT NULL DEFAULT now(),
  details jsonb NOT NULL,
  notification_status text NOT NULL CHECK (notification_status IN ('disabled', 'pending', 'accepted', 'failed'))
);
CREATE INDEX contact_inquiry_received_idx ON contact_inquiry (received_at DESC, inquiry_id DESC);

CREATE TABLE contact_rate_window (
  limiter_key text NOT NULL,
  window_start bigint NOT NULL,
  attempts integer NOT NULL CHECK (attempts > 0),
  PRIMARY KEY (limiter_key, window_start)
);
CREATE INDEX contact_rate_window_age_idx ON contact_rate_window (window_start);
