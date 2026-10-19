BEGIN;

ALTER TABLE projects ADD COLUMN slug varchar(255);

CREATE TEMP TABLE project_slug_backfill_135 ON COMMIT DROP AS
SELECT id, created_at,
       COALESCE(
           NULLIF(trim(both '-' from left(trim(both '-' from regexp_replace(
               translate(title, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'),
               '[^a-z0-9]+', '-', 'g'
           )), 60)), ''),
           'project-' || id::text
       ) AS base_slug
FROM projects;

DO $$
DECLARE
    entry record;
    candidate text;
    suffix integer;
BEGIN
    FOR entry IN SELECT * FROM project_slug_backfill_135 ORDER BY created_at, id LOOP
        candidate := entry.base_slug;
        suffix := 1;
        -- Reserve native titles such as foo-2 before suffixing duplicate foo titles.
        WHILE EXISTS (SELECT 1 FROM projects WHERE slug = candidate)
           OR (candidate <> entry.base_slug AND EXISTS (
               SELECT 1 FROM project_slug_backfill_135 WHERE base_slug = candidate
           )) LOOP
            suffix := suffix + 1;
            candidate := entry.base_slug || '-' || suffix::text;
        END LOOP;
        UPDATE projects SET slug = candidate WHERE id = entry.id;
    END LOOP;
END $$;

ALTER TABLE projects
    ALTER COLUMN slug SET NOT NULL,
    ADD CONSTRAINT projects_slug_key UNIQUE (slug),
    ADD CONSTRAINT projects_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

COMMIT;
