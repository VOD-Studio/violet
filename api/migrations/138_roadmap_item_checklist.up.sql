ALTER TABLE roadmap_items
    ADD COLUMN checklist JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(checklist) = 'array');
