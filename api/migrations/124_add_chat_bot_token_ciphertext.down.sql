-- 回滚 124：丢弃密文列（token_hash 与表本身不动）
ALTER TABLE chat_bots DROP COLUMN IF EXISTS token_encrypted;
