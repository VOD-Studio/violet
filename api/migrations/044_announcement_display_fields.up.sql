-- 公告展示形态扩展：支持 banner/card/article 三态 + 影响范围 + 排序
--
-- 设计说明（见 CONTEXT.md「公告展示」章节）：
-- - display：展示形态（banner/card/article），决定渲染布局与内容载体字段
-- - type 列保留原名，语义重定义为 severity（纯视觉维度：配色/图标/日志标签）
--   取值不变（info/warning/success/error），避免破坏性 RENAME
-- - sort_order：手动排序，复用项目主流命名（projects/emojis 均用此名）
-- - affects：影响范围，JSON 数组，预定义枚举多选（posts/comments/auth/...）
-- - content_md/content_html：article 形态的富文本双列（对齐 posts 表）
-- - cover_image/excerpt：card/article 形态的封面与摘要
-- - content 列保留，banner 形态继续使用纯文本

ALTER TABLE announcements
    ADD COLUMN IF NOT EXISTS display      VARCHAR(20) NOT NULL DEFAULT 'banner',
    ADD COLUMN IF NOT EXISTS sort_order   INTEGER     NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS affects      JSONB,
    ADD COLUMN IF NOT EXISTS content_md   TEXT,
    ADD COLUMN IF NOT EXISTS content_html TEXT,
    ADD COLUMN IF NOT EXISTS cover_image  TEXT,
    ADD COLUMN IF NOT EXISTS excerpt      TEXT;

-- 排序索引：FindActive 按 sort_order ASC, created_at DESC 返回
CREATE INDEX IF NOT EXISTS idx_announcements_sort_order ON announcements(sort_order);

-- display 约束：只允许三态
ALTER TABLE announcements
    ADD CONSTRAINT chk_announcements_display
    CHECK (display IN ('banner', 'card', 'article'));
