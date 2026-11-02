-- Профиль, аватарки, друзья, чаты. Уже применено к Neon.
ALTER TABLE profiles ADD COLUMN username text;
CREATE UNIQUE INDEX profiles_username_uq ON profiles (lower(username));
ALTER TABLE profiles ADD COLUMN avatar_updated_at timestamptz;
ALTER TABLE profiles ADD COLUMN searchable boolean NOT NULL DEFAULT true;
CREATE TABLE avatars (user_id text PRIMARY KEY REFERENCES auth_user(id) ON DELETE CASCADE, data bytea NOT NULL, mime text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE friendships (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), requester_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE, addressee_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE, status text NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (requester_id, addressee_id));
CREATE INDEX friendships_addressee_idx ON friendships (addressee_id);
CREATE TABLE conversations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid UNIQUE REFERENCES events(id) ON DELETE CASCADE, user_a text REFERENCES auth_user(id) ON DELETE CASCADE, user_b text REFERENCES auth_user(id) ON DELETE CASCADE, last_message_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (user_a, user_b));
CREATE TABLE messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, user_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE, body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX messages_conv_created_idx ON messages (conversation_id, created_at);
CREATE TABLE chat_reads (conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, user_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE, last_read_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (conversation_id, user_id));
