ALTER TABLE personas
    ADD COLUMN default_locale VARCHAR(35) NOT NULL DEFAULT 'zh-CN',
    ADD COLUMN avatar_file_id UUID REFERENCES files(id) ON DELETE RESTRICT;

UPDATE personas AS p
SET avatar_file_id = (
    SELECT pi.file_id
    FROM persona_images AS pi
    WHERE pi.persona_id = p.id
    ORDER BY pi.position
    LIMIT 1
);

UPDATE files AS f
SET ref_count = f.ref_count + refs.reference_count
FROM (
    SELECT avatar_file_id, COUNT(*)::INTEGER AS reference_count
    FROM personas
    WHERE avatar_file_id IS NOT NULL
    GROUP BY avatar_file_id
) AS refs
WHERE f.id = refs.avatar_file_id;

CREATE TABLE persona_localizations (
    persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    locale VARCHAR(35) NOT NULL,
    name VARCHAR(120) NOT NULL DEFAULT '',
    subtitle VARCHAR(240) NOT NULL DEFAULT '',
    summary VARCHAR(500) NOT NULL DEFAULT '',
    content_md TEXT NOT NULL DEFAULT '',
    content_html TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (persona_id, locale)
);

INSERT INTO persona_localizations (
    persona_id,
    locale,
    name,
    subtitle,
    summary,
    content_md,
    content_html
)
SELECT
    id,
    'zh-CN',
    name,
    subtitle,
    summary,
    content_md,
    content_html
FROM personas;

DROP INDEX idx_personas_name_lower;
CREATE INDEX idx_persona_localizations_name_lower
    ON persona_localizations(LOWER(name));

ALTER TABLE persona_facts
    ADD COLUMN locale VARCHAR(35) NOT NULL DEFAULT 'zh-CN';
ALTER TABLE persona_facts DROP CONSTRAINT persona_facts_pkey;
ALTER TABLE persona_facts
    ADD PRIMARY KEY (persona_id, locale, position),
    ADD CONSTRAINT fk_persona_facts_localization
        FOREIGN KEY (persona_id, locale)
        REFERENCES persona_localizations(persona_id, locale)
        ON DELETE CASCADE;

ALTER TABLE persona_images
    ADD COLUMN locale VARCHAR(35) NOT NULL DEFAULT 'zh-CN';
ALTER TABLE persona_images DROP CONSTRAINT persona_images_pkey;
ALTER TABLE persona_images DROP CONSTRAINT persona_images_persona_id_file_id_key;
ALTER TABLE persona_images
    ADD PRIMARY KEY (persona_id, locale, position),
    ADD CONSTRAINT uq_persona_images_locale_file UNIQUE (persona_id, locale, file_id),
    ADD CONSTRAINT fk_persona_images_localization
        FOREIGN KEY (persona_id, locale)
        REFERENCES persona_localizations(persona_id, locale)
        ON DELETE CASCADE;

ALTER TABLE personas
    DROP COLUMN name,
    DROP COLUMN subtitle,
    DROP COLUMN summary,
    DROP COLUMN content_md,
    DROP COLUMN content_html;
