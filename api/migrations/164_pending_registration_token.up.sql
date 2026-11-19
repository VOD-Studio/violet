ALTER TABLE users ADD COLUMN registration_token_hash text;
CREATE UNIQUE INDEX idx_users_registration_token ON users (registration_token_hash) WHERE registration_token_hash IS NOT NULL;
