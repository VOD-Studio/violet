-- 表情包组表
CREATE TABLE sticker_groups (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL,
    slug        VARCHAR(100) NOT NULL UNIQUE,
    type        VARCHAR(20) NOT NULL DEFAULT 'custom' CHECK (type IN ('custom', 'emoji', 'kaomoji')),
    icon_url    VARCHAR(512),
    description TEXT,
    sort_order  SMALLINT NOT NULL DEFAULT 0,
    is_hot      BOOLEAN NOT NULL DEFAULT false,
    is_official BOOLEAN NOT NULL DEFAULT false,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 表情包表
CREATE TABLE stickers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id    UUID NOT NULL REFERENCES sticker_groups(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    slug        VARCHAR(100) NOT NULL,
    image_url   VARCHAR(512) NOT NULL,
    width       SMALLINT DEFAULT 60,
    height      SMALLINT DEFAULT 60,
    usage_count INTEGER NOT NULL DEFAULT 0,
    sort_order  SMALLINT NOT NULL DEFAULT 0,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(group_id, slug)
);

-- 用户收藏表情表
CREATE TABLE user_favorite_stickers (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sticker_id  UUID NOT NULL REFERENCES stickers(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(user_id, sticker_id)
);

-- 索引
CREATE INDEX idx_stickers_group_id ON stickers(group_id);
CREATE INDEX idx_stickers_usage_count ON stickers(usage_count DESC);
CREATE INDEX idx_sticker_groups_sort_order ON sticker_groups(sort_order);
CREATE INDEX idx_user_favorite_stickers_user ON user_favorite_stickers(user_id);

-- 更新时间触发器
CREATE OR REPLACE FUNCTION update_sticker_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sticker_groups_updated_at
    BEFORE UPDATE ON sticker_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_sticker_groups_updated_at();

CREATE OR REPLACE FUNCTION update_stickers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stickers_updated_at
    BEFORE UPDATE ON stickers
    FOR EACH ROW
    EXECUTE FUNCTION update_stickers_updated_at();