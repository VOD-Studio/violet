-- 098: 图片消息支持单条多图（chat_message_media 关联表）
-- chat_messages.media_id 单列无法承载一条消息多张图片。媒体引用移入关联表后，
-- 「image 消息必须带媒体」无法再写在行级 CHECK（跨表断言不了关联行），改由领域层
-- NewImageMessage 校验 mediaIDs 非空保证。
CREATE TABLE chat_message_media (
    message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    media_id   UUID NOT NULL REFERENCES files(id) ON DELETE RESTRICT,
    position   SMALLINT NOT NULL,
    PRIMARY KEY (message_id, media_id)
);

INSERT INTO chat_message_media (message_id, media_id, position)
SELECT id, media_id, 0 FROM chat_messages WHERE media_id IS NOT NULL;

ALTER TABLE chat_messages
    DROP CONSTRAINT IF EXISTS chk_chat_message_payload,
    DROP COLUMN media_id;

ALTER TABLE chat_messages
    ADD CONSTRAINT chk_chat_message_payload CHECK (
        (message_type = 'text' AND length(btrim(content)) > 0)
        OR (message_type = 'image')
        OR (message_type = 'system' AND length(btrim(content)) > 0)
        OR (message_type = 'tweet_share' AND shared_tweet_id IS NOT NULL)
    );
