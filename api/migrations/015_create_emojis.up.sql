-- 创建表情分组表
CREATE TABLE IF NOT EXISTS emoji_groups (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(50) NOT NULL,
  source      VARCHAR(30) NOT NULL DEFAULT 'system',
  sort_order  INT NOT NULL DEFAULT 0,
  is_enabled  BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (name)
);

COMMENT ON TABLE emoji_groups IS '表情分组';
COMMENT ON COLUMN emoji_groups.name IS '分组名称';
COMMENT ON COLUMN emoji_groups.source IS '来源: system/bilibili/custom';
COMMENT ON COLUMN emoji_groups.sort_order IS '排序（越小越靠前）';
COMMENT ON COLUMN emoji_groups.is_enabled IS '是否启用';

-- 创建表情表
CREATE TABLE IF NOT EXISTS emojis (
  id           SERIAL PRIMARY KEY,
  group_id     INT NOT NULL,
  name         VARCHAR(50) NOT NULL,
  url          VARCHAR(500) DEFAULT NULL,
  text_content VARCHAR(50) DEFAULT NULL,
  sort_order   INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (group_id, name),
  FOREIGN KEY (group_id) REFERENCES emoji_groups(id) ON DELETE CASCADE
);

COMMENT ON TABLE emojis IS '表情';
COMMENT ON COLUMN emojis.group_id IS '所属分组';
COMMENT ON COLUMN emojis.name IS '表情名称（用于 [爱心] 标记）';
COMMENT ON COLUMN emojis.url IS '图片URL（图片类表情）';
COMMENT ON COLUMN emojis.text_content IS '纯文本内容（颜文字类）';
COMMENT ON COLUMN emojis.sort_order IS '排序';

-- 删除旧的 sticker 相关表（如果存在）
DROP TABLE IF EXISTS user_favorite_stickers;
DROP TABLE IF EXISTS stickers;
DROP TABLE IF EXISTS sticker_groups;