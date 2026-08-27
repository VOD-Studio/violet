-- 111: gallery_items 表（PRD-0022 / issue #264）
-- 图集的有序媒体项：引用 files.id（不拷贝 URL），position 承载展示顺序。
-- 文件引用计数（files.ref_count）由应用层维护（挂接 +1 / 移除 -1），
-- ON DELETE CASCADE 只管行级联不管 ref_count——删图集用例先解绑再删聚合。

CREATE TABLE gallery_items (
    gallery_id  UUID         NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
    file_id     UUID         NOT NULL REFERENCES files(id),
    caption     TEXT         NOT NULL DEFAULT '',               -- 图片说明（≤200 rune，可空）
    position    INTEGER      NOT NULL,                          -- 展示顺序，0 起升序
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (gallery_id, file_id)
);

-- 按图集取有序媒体列表
CREATE INDEX idx_gallery_items_gallery ON gallery_items(gallery_id, position);
