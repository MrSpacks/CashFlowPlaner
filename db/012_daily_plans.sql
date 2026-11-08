-- План дня: Claude каждое утро пишет план, человек отмечает задачи и вечером пишет итог.
CREATE TABLE daily_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  date date NOT NULL,
  headline text,
  focus text,
  note text,
  tasks jsonb NOT NULL DEFAULT '[]'::jsonb,
  done jsonb NOT NULL DEFAULT '{}'::jsonb,
  feedback jsonb,
  submitted_at timestamptz,
  generated_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX daily_plans_owner_date_idx ON daily_plans (owner_id, date);
