ALTER TABLE galleries
    DROP CONSTRAINT IF EXISTS fk_galleries_published_revision,
    DROP CONSTRAINT IF EXISTS fk_galleries_working_revision;

DROP TABLE IF EXISTS gallery_revision_items;
DROP TABLE IF EXISTS gallery_revisions;
DROP TABLE IF EXISTS galleries;
