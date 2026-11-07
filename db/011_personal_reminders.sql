CREATE TABLE personal_reminders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE, title text NOT NULL, times text[] NOT NULL, enabled boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX personal_reminders_owner_idx ON personal_reminders (owner_id);
CREATE TABLE personal_reminder_sends (reminder_id uuid NOT NULL REFERENCES personal_reminders(id) ON DELETE CASCADE, slot text NOT NULL, sent_at timestamptz NOT NULL DEFAULT now(), done_at timestamptz, PRIMARY KEY (reminder_id, slot));
