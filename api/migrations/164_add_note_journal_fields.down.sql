DROP INDEX idx_notes_type_published_cursor;
DROP INDEX idx_notes_project_published_cursor;

ALTER TABLE notes
    DROP COLUMN pitfall_code,
    DROP COLUMN pitfall_resolved,
    DROP COLUMN pitfall_remedy,
    DROP COLUMN pitfall_cause,
    DROP COLUMN pitfall_symptom,
    DROP COLUMN project_id,
    DROP COLUMN note_type;
