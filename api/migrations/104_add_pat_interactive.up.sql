ALTER TABLE api_tokens ADD COLUMN IF NOT EXISTS interactive boolean NOT NULL DEFAULT true;
