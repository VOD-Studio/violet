CREATE TABLE roadmap_item_counters (
    project_id  UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    last_number BIGINT NOT NULL CHECK (last_number >= 1)
);

CREATE TABLE roadmap_items (
    id                UUID PRIMARY KEY,
    project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    number            BIGINT NOT NULL CHECK (number >= 1),
    title             TEXT NOT NULL CHECK (BTRIM(title) <> ''),
    description       TEXT NOT NULL DEFAULT '',
    stage             TEXT NOT NULL CHECK (stage IN ('planned', 'in_progress', 'completed')),
    position          TEXT COLLATE "C" NOT NULL CHECK (position ~ '^[0-9A-Za-z]*[1-9A-Za-z]$'),
    tags              JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(tags) = 'array'),
    links             JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(links) = 'array'),
    completion_date   DATE,
    delivered_version TEXT NOT NULL DEFAULT '',
    deleted_at        TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (project_id, number),
    CHECK ((stage = 'completed' AND completion_date IS NOT NULL)
        OR (stage <> 'completed' AND completion_date IS NULL AND delivered_version = ''))
);

CREATE INDEX idx_roadmap_items_active_order
    ON roadmap_items (project_id, stage, position, number) WHERE deleted_at IS NULL;
CREATE INDEX idx_roadmap_items_completed_order
    ON roadmap_items (project_id, completion_date DESC, number DESC)
    WHERE deleted_at IS NULL AND stage = 'completed';
