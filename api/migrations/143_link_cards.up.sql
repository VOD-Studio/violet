CREATE TABLE link_cards (
    id UUID PRIMARY KEY,
    url TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    site_name VARCHAR(120) NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT '',
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_error VARCHAR(200) NOT NULL DEFAULT '',
    fail_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX uniq_link_cards_url ON link_cards(url);

COMMENT ON TABLE link_cards IS 'OG 链接卡片缓存：按规范化 URL 全局去重，跨内容共享，TTL 惰性重抓';
COMMENT ON COLUMN link_cards.status IS '抓取状态机: pending|ok|failed；failed=从未成功';
COMMENT ON COLUMN link_cards.expires_at IS '快照有效期/失败退避结束点，到达后下次读取触发重抓';
COMMENT ON COLUMN link_cards.image_url IS '封面本站访问路径(/uploads/link-previews/...)，无封面为空串';
