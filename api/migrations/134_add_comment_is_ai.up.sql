-- MCP/AI agent 发表的评论身份标记：与真人评论区分展示（专用头像 + AI 徽章）。
-- created_by 仍指向 PAT 持有人，便于审核追溯；is_ai 只影响对外展示身份。
ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_ai BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN comments.is_ai IS '是否由 MCP/AI agent 发表；true 时展示 AI 身份与专用头像';
