ALTER TABLE gallery_revisions
    ADD COLUMN location varchar(120) NOT NULL DEFAULT '';

COMMENT ON COLUMN gallery_revisions.location IS '作者显式填写的可选拍摄地点；随 revision 发布，空串表示未填写';
