ALTER TABLE notes
    ADD COLUMN note_type VARCHAR(16) NOT NULL DEFAULT 'unclassified'
        CHECK (note_type IN ('unclassified', 'pitfall', 'idea', 'excerpt')),
    ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    ADD COLUMN pitfall_symptom TEXT NOT NULL DEFAULT '',
    ADD COLUMN pitfall_cause TEXT NOT NULL DEFAULT '',
    ADD COLUMN pitfall_remedy TEXT NOT NULL DEFAULT '',
    ADD COLUMN pitfall_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN pitfall_code TEXT NOT NULL DEFAULT '';

CREATE INDEX idx_notes_project_published_cursor ON notes (project_id, published_at DESC, id DESC)
    WHERE project_id IS NOT NULL;
CREATE INDEX idx_notes_type_published_cursor ON notes (note_type, published_at DESC, id DESC)
    WHERE status = 'published';
