-- Escala de Trabalho - initial schema

CREATE TABLE IF NOT EXISTS people (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  "group"     TEXT NOT NULL DEFAULT 'geral' CHECK ("group" IN ('geral','implantacao')),
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  email          TEXT PRIMARY KEY,
  display_name   TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT 'usuario' CHECK (role IN ('admin','usuario','implantacao')),
  active         BOOLEAN NOT NULL DEFAULT true,
  view_only      BOOLEAN NOT NULL DEFAULT false,
  password_hash  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shifts (
  id           TEXT PRIMARY KEY,
  person_name  TEXT NOT NULL,
  category     TEXT NOT NULL CHECK (category IN ('ferias','chat','h22','homeoffice','plantao')),
  date         DATE NOT NULL,
  note         TEXT NOT NULL DEFAULT '',
  created_by   TEXT REFERENCES users(email) ON DELETE SET NULL,
  group_id     TEXT,
  group_type   TEXT CHECK (group_type IN ('range','recurring') OR group_type IS NULL),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date);
CREATE INDEX IF NOT EXISTS idx_shifts_group_id ON shifts(group_id) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shifts_created_by ON shifts(created_by);
CREATE INDEX IF NOT EXISTS idx_people_group ON people("group");

-- Session store used by connect-pg-simple (created automatically on first
-- run too, but declared here so a fresh migrate always provisions it).
CREATE TABLE IF NOT EXISTS session (
  sid    VARCHAR NOT NULL COLLATE "default",
  sess   JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
) WITH (OIDS=FALSE);

ALTER TABLE session DROP CONSTRAINT IF EXISTS session_pkey;
ALTER TABLE session ADD CONSTRAINT session_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE;
CREATE INDEX IF NOT EXISTS idx_session_expire ON session(expire);
