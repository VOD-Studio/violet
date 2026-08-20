-- 083: 每个聊天成员独立的系统通知静音状态
ALTER TABLE chat_conversation_members
    ADD COLUMN is_muted BOOLEAN NOT NULL DEFAULT FALSE;
