-- 添加缩略图字段到媒体表
ALTER TABLE media ADD COLUMN thumbnail TEXT;

-- 创建索引加速缩略图查询
CREATE INDEX idx_media_thumbnail ON media(thumbnail) WHERE thumbnail IS NOT NULL;