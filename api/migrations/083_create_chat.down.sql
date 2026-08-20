DELETE FROM role_permissions
WHERE permission_id = (SELECT id FROM permissions WHERE code = 'chat:manage');

DELETE FROM permissions WHERE code = 'chat:manage';

DROP TABLE IF EXISTS chat_push_subscriptions;
DROP TABLE IF EXISTS chat_events;
DROP TABLE IF EXISTS chat_read_positions;
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS chat_direct_pairs;
DROP TABLE IF EXISTS chat_conversation_members;
DROP TABLE IF EXISTS chat_conversations;
