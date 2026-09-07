ALTER TABLE personas
    ADD COLUMN name VARCHAR(120) NOT NULL DEFAULT '',
    ADD COLUMN subtitle VARCHAR(240) NOT NULL DEFAULT '',
    ADD COLUMN summary VARCHAR(500) NOT NULL DEFAULT '',
    ADD COLUMN content_md TEXT NOT NULL DEFAULT '',
    ADD COLUMN content_html TEXT NOT NULL DEFAULT '';

UPDATE personas AS p
SET
    name = l.name,
    subtitle = l.subtitle,
    summary = l.summary,
    content_md = l.content_md,
    content_html = l.content_html
FROM persona_localizations AS l
WHERE l.persona_id = p.id
  AND l.locale = p.default_locale;

UPDATE files AS f
SET ref_count = GREATEST(0, f.ref_count - refs.reference_count)
FROM (
    SELECT i.file_id, COUNT(*)::INTEGER AS reference_count
    FROM persona_images AS i
    JOIN personas AS p ON p.id = i.persona_id
    WHERE i.locale <> p.default_locale
    GROUP BY i.file_id
) AS refs
WHERE f.id = refs.file_id;

ALTER TABLE persona_facts DROP CONSTRAINT fk_persona_facts_localization;
ALTER TABLE persona_facts DROP CONSTRAINT persona_facts_pkey;
DELETE FROM persona_facts AS f
USING personas AS p
WHERE f.persona_id = p.id
  AND f.locale <> p.default_locale;
ALTER TABLE persona_facts DROP COLUMN locale;
ALTER TABLE persona_facts ADD PRIMARY KEY (persona_id, position);

ALTER TABLE persona_images DROP CONSTRAINT fk_persona_images_localization;
ALTER TABLE persona_images DROP CONSTRAINT uq_persona_images_locale_file;
ALTER TABLE persona_images DROP CONSTRAINT persona_images_pkey;
DELETE FROM persona_images AS i
USING personas AS p
WHERE i.persona_id = p.id
  AND i.locale <> p.default_locale;
ALTER TABLE persona_images DROP COLUMN locale;
ALTER TABLE persona_images
    ADD PRIMARY KEY (persona_id, position),
    ADD CONSTRAINT persona_images_persona_id_file_id_key UNIQUE (persona_id, file_id);

UPDATE files AS f
SET ref_count = GREATEST(0, f.ref_count - refs.reference_count)
FROM (
    SELECT avatar_file_id, COUNT(*)::INTEGER AS reference_count
    FROM personas
    WHERE avatar_file_id IS NOT NULL
    GROUP BY avatar_file_id
) AS refs
WHERE f.id = refs.avatar_file_id;

DROP INDEX idx_persona_localizations_name_lower;
DROP TABLE persona_localizations;

ALTER TABLE personas
    DROP COLUMN avatar_file_id,
    DROP COLUMN default_locale;

CREATE INDEX idx_personas_name_lower ON personas(LOWER(name));
