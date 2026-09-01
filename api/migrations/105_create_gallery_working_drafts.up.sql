-- 105: 图集视觉作品的工作稿双快照骨架（PRD-0023 / ADR-0014 / issue #282）

CREATE TABLE galleries (
    id                    UUID        PRIMARY KEY,
    author_id             UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    slug                  VARCHAR(120) UNIQUE,
    working_revision_id   UUID        NOT NULL,
    published_revision_id UUID,
    version               BIGINT      NOT NULL DEFAULT 1 CHECK (version >= 1),
    published_at          TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE gallery_revisions (
    id         UUID         PRIMARY KEY,
    gallery_id UUID         NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
    title      VARCHAR(120) NOT NULL DEFAULT '',
    summary    VARCHAR(500) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (gallery_id, id)
);

CREATE TABLE gallery_revision_items (
    revision_id      UUID         NOT NULL REFERENCES gallery_revisions(id) ON DELETE CASCADE,
    file_id          UUID         NOT NULL REFERENCES files(id) ON DELETE RESTRICT,
    position         SMALLINT     NOT NULL CHECK (position >= 0 AND position < 50),
    caption          VARCHAR(500) NOT NULL DEFAULT '',
    alt_text_override VARCHAR(300) NOT NULL DEFAULT '',
    PRIMARY KEY (revision_id, file_id),
    UNIQUE (revision_id, position)
);

ALTER TABLE galleries
    ADD CONSTRAINT fk_galleries_working_revision
        FOREIGN KEY (id, working_revision_id)
        REFERENCES gallery_revisions(gallery_id, id)
        DEFERRABLE INITIALLY DEFERRED,
    ADD CONSTRAINT fk_galleries_published_revision
        FOREIGN KEY (id, published_revision_id)
        REFERENCES gallery_revisions(gallery_id, id)
        DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX idx_galleries_author_created ON galleries(author_id, created_at DESC, id DESC);
CREATE INDEX idx_gallery_revisions_gallery ON gallery_revisions(gallery_id);
CREATE INDEX idx_gallery_revision_items_file ON gallery_revision_items(file_id);
