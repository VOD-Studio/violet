ALTER TABLE projects
    ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'stable', 'archived')),
    ADD COLUMN docs_url TEXT NOT NULL DEFAULT '';
