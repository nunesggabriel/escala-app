-- Makes shift categories admin-manageable instead of a fixed list baked into
-- the code. Safe to run on a database that already has shifts in it: it only
-- adds a new table, seeds it with the 5 categories that already existed
-- (same keys, so existing shifts keep working untouched), and relaxes the
-- old fixed-enum constraint so new categories can be created later.

CREATE TABLE IF NOT EXISTS categories (
  key         TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  color       TEXT NOT NULL,               -- hex color, e.g. #2563eb
  presencial  BOOLEAN NOT NULL DEFAULT false,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO categories (key, label, color, presencial, sort_order) VALUES
  ('ferias',     'Férias',      '#059669', false, 0),
  ('chat',       'Chat',        '#db2777', true,  1),
  ('h22',        '22h',         '#b45309', true,  2),
  ('homeoffice', 'Home Office', '#7c3aed', false, 3),
  ('plantao',    'Plantão',     '#dc2626', true,  4)
ON CONFLICT (key) DO NOTHING;

-- Category validity used to be enforced by this fixed CHECK; from now on the
-- API checks the category against the `categories` table instead, so admins
-- can add new ones without a code change.
ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_category_check;
