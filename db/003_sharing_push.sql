-- Push-подписки и журнал напоминаний. Уже применено к Neon.
CREATE TABLE push_subscriptions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE, endpoint text NOT NULL UNIQUE, p256dh text NOT NULL, auth text NOT NULL, locale text NOT NULL DEFAULT 'en', created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX push_subscriptions_user_idx ON push_subscriptions (user_id);
CREATE TABLE reminder_log (user_id text NOT NULL, day date NOT NULL, PRIMARY KEY (user_id, day));
