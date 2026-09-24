-- 122: 聊天 bot 凭证表
-- bot 是以虚拟用户身份接入站内聊天的外部程序凭证（见 PRD-0029）。
-- 明文 token 不落库，只存 SHA-256 hex（64 字符）；avatar_id 不建外键，
-- 由应用层经 FileRepository 校验存在（与 chat_messages.media 关联同构）。
CREATE TABLE chat_bots (
    id          UUID         NOT NULL PRIMARY KEY,
    user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(80)  NOT NULL,
    avatar_id   UUID,
    token_hash  VARCHAR(64)  NOT NULL,
    enabled     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- user_id 唯一：一个虚拟用户至多对应一个 bot。
CREATE UNIQUE INDEX idx_chat_bots_user_id    ON chat_bots(user_id);
-- token_hash 唯一：鉴权按哈希反查，唯一索引保证 O(log n) 命中且防重复。
CREATE UNIQUE INDEX idx_chat_bots_token_hash ON chat_bots(token_hash);
