CREATE TABLE demo_users (
  id uuid PRIMARY KEY,
  role text NOT NULL UNIQUE CHECK (role IN ('operations', 'manager', 'accounts', 'admin')),
  name text NOT NULL
);

CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES demo_users(id),
  expires_at timestamptz NOT NULL
);

CREATE TABLE settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  body jsonb NOT NULL
);

CREATE TABLE enquiries (
  id uuid PRIMARY KEY,
  source_ref text NOT NULL UNIQUE,
  body jsonb NOT NULL
);

CREATE TABLE quotes (
  id uuid PRIMARY KEY,
  enquiry_id uuid NOT NULL UNIQUE REFERENCES enquiries(id),
  body jsonb NOT NULL
);

CREATE TABLE jobs (
  id uuid PRIMARY KEY,
  quote_id uuid NOT NULL UNIQUE REFERENCES quotes(id),
  body jsonb NOT NULL
);

CREATE TABLE audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity_id text NOT NULL,
  body jsonb NOT NULL
);

CREATE INDEX audit_events_entity_id ON audit_events(entity_id, id DESC);
