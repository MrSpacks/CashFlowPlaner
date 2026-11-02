ALTER TABLE calendar_invites ADD COLUMN invitee_user_id text REFERENCES auth_user(id) ON DELETE CASCADE;
