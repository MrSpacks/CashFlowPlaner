ALTER TABLE fixed_expenses ADD COLUMN IF NOT EXISTS category text;
CREATE TABLE spendings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE, date date NOT NULL, amount numeric(14,2) NOT NULL, currency char(3) NOT NULL DEFAULT 'CZK', category text NOT NULL DEFAULT 'other', note text, receipt bytea, receipt_type text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX spendings_owner_date_idx ON spendings (owner_id, date);
CREATE TABLE budgets (owner_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE, category text NOT NULL, monthly_limit numeric(14,2) NOT NULL, currency char(3) NOT NULL DEFAULT 'CZK', PRIMARY KEY (owner_id, category));
