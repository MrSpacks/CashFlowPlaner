-- Начальная схема CashFlowPlaner (соответствует src/db/schema.ts).
-- Уже применена к базе Neon. Дальнейшие изменения — через `npx drizzle-kit push`.

CREATE TYPE member_role AS ENUM ('owner','editor','viewer');
CREATE TYPE event_type AS ENUM ('trip','birthday','health','purchase','other');
CREATE TYPE event_status AS ENUM ('idea','planned','confirmed','done','cancelled');
CREATE TYPE event_priority AS ENUM ('must','want','movable');
CREATE TYPE event_visibility AS ENUM ('calendar','private');
CREATE TYPE recurrence AS ENUM ('none','yearly');
CREATE TYPE payment_status AS ENUM ('unpaid','partial','paid');
CREATE TYPE share_type AS ENUM ('equal','percent','amount');

CREATE TABLE profiles (
  user_id text PRIMARY KEY,
  display_name text,
  base_currency char(3) NOT NULL DEFAULT 'CZK',
  timezone text NOT NULL DEFAULT 'Europe/Prague',
  cushion_amount numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE calendars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE calendar_members (
  calendar_id uuid NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  role member_role NOT NULL DEFAULT 'viewer',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (calendar_id, user_id)
);

CREATE TABLE calendar_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id uuid NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  role member_role NOT NULL DEFAULT 'viewer',
  created_by text NOT NULL,
  expires_at timestamptz,
  accepted_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id uuid NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
  type event_type NOT NULL DEFAULT 'other',
  title text NOT NULL,
  start_date date,
  end_date date,
  status event_status NOT NULL DEFAULT 'planned',
  priority event_priority NOT NULL DEFAULT 'want',
  visibility event_visibility NOT NULL DEFAULT 'calendar',
  recurrence recurrence NOT NULL DEFAULT 'none',
  currency char(3) NOT NULL DEFAULT 'CZK',
  notes text,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX events_calendar_start_idx ON events (calendar_id, start_date);

CREATE TABLE event_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id text,
  display_name text NOT NULL,
  role member_role NOT NULL DEFAULT 'editor',
  invite_token text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX participants_event_idx ON event_participants (event_id);
CREATE INDEX participants_user_idx ON event_participants (user_id);

CREATE TABLE expense_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text,
  amount numeric(14,2) NOT NULL,
  currency char(3) NOT NULL,
  is_estimate boolean NOT NULL DEFAULT true,
  due_date date,
  status payment_status NOT NULL DEFAULT 'unpaid',
  paid_by_participant_id uuid REFERENCES event_participants(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX expense_event_idx ON expense_items (event_id);
CREATE INDEX expense_due_idx ON expense_items (due_date);

CREATE TABLE expense_shares (
  expense_item_id uuid NOT NULL REFERENCES expense_items(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES event_participants(id) ON DELETE CASCADE,
  share_type share_type NOT NULL DEFAULT 'equal',
  value numeric(14,4),
  PRIMARY KEY (expense_item_id, participant_id)
);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_item_id uuid NOT NULL REFERENCES expense_items(id) ON DELETE CASCADE,
  participant_id uuid REFERENCES event_participants(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL,
  currency char(3) NOT NULL,
  paid_at date NOT NULL,
  rate_to_base numeric(18,8),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  from_participant_id uuid NOT NULL REFERENCES event_participants(id) ON DELETE CASCADE,
  to_participant_id uuid NOT NULL REFERENCES event_participants(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL,
  currency char(3) NOT NULL,
  settled_at date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title text NOT NULL,
  due_date date,
  done boolean NOT NULL DEFAULT false,
  assignee_participant_id uuid REFERENCES event_participants(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE income_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  name text NOT NULL,
  currency char(3) NOT NULL DEFAULT 'CZK',
  pay_day integer,
  is_fixed boolean NOT NULL DEFAULT false,
  default_amount numeric(14,2),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE incomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES income_sources(id) ON DELETE CASCADE,
  month date NOT NULL,
  expected_amount numeric(14,2),
  actual_amount numeric(14,2),
  received_at date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX incomes_source_month_idx ON incomes (source_id, month);

CREATE TABLE fixed_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  name text NOT NULL,
  amount numeric(14,2) NOT NULL,
  currency char(3) NOT NULL DEFAULT 'CZK',
  day_of_month integer,
  active_from date,
  active_to date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE balance_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  amount numeric(14,2) NOT NULL,
  currency char(3) NOT NULL DEFAULT 'CZK',
  as_of_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE exchange_rates (
  date date NOT NULL,
  base char(3) NOT NULL,
  quote char(3) NOT NULL,
  rate numeric(18,8) NOT NULL,
  PRIMARY KEY (date, base, quote)
);
