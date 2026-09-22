-- 124: bot 凭据可反复查看（PRD-0029 增补）
-- token_hash 继续负责鉴权比对；新增可逆密文列，让管理员随时能取回明文。
-- 存量行为 NULL：建表时没存明文，解不出来，只能重置一次凭据才能查看。
ALTER TABLE chat_bots ADD COLUMN token_encrypted TEXT;
