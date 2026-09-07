CREATE TABLE personas (
    id UUID PRIMARY KEY,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    name VARCHAR(120) NOT NULL DEFAULT '',
    subtitle VARCHAR(240) NOT NULL DEFAULT '',
    summary VARCHAR(500) NOT NULL DEFAULT '',
    content_md TEXT NOT NULL DEFAULT '',
    content_html TEXT NOT NULL DEFAULT '',
    version BIGINT NOT NULL DEFAULT 1 CHECK (version >= 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_personas_updated ON personas(updated_at DESC, id DESC);
CREATE INDEX idx_personas_name_lower ON personas(LOWER(name));

CREATE TABLE persona_facts (
    persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    position INTEGER NOT NULL CHECK (position >= 0),
    label VARCHAR(40) NOT NULL,
    value VARCHAR(300) NOT NULL,
    PRIMARY KEY (persona_id, position)
);

CREATE TABLE persona_images (
    persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    position INTEGER NOT NULL CHECK (position >= 0),
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE RESTRICT,
    caption VARCHAR(500) NOT NULL DEFAULT '',
    alt_text_override VARCHAR(300) NOT NULL DEFAULT '',
    PRIMARY KEY (persona_id, position),
    UNIQUE (persona_id, file_id)
);

CREATE INDEX idx_persona_images_file ON persona_images(file_id);

CREATE TABLE persona_selection (
    singleton_key SMALLINT PRIMARY KEY DEFAULT 1 CHECK (singleton_key = 1),
    persona_id UUID NOT NULL UNIQUE REFERENCES personas(id) ON DELETE RESTRICT,
    activated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
