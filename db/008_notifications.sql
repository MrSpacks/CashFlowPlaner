-- Центр уведомлений и язык пользователя (для текстов уведомлений). Уже применено к Neon.
CREATE TABLE notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE, title text NOT NULL, body text NOT NULL, url text NOT NULL DEFAULT '/', read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX notifications_user_created_idx ON notifications (user_id, created_at DESC);
ALTER TABLE profiles ADD COLUMN locale text;
