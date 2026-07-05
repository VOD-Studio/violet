-- 回滚 046_add_comment_anchor

ALTER TABLE comments DROP CONSTRAINT IF EXISTS chk_anchor_requires_login;
ALTER TABLE comments DROP COLUMN IF EXISTS anchor_block_text_hash;
ALTER TABLE comments DROP COLUMN IF EXISTS anchor_selected_text;
ALTER TABLE comments DROP COLUMN IF EXISTS anchor_end_offset;
ALTER TABLE comments DROP COLUMN IF EXISTS anchor_start_offset;
ALTER TABLE comments DROP COLUMN IF EXISTS anchor_block_id;
