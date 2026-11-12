-- 151: 内置默认小黄脸。系统表情目录原本只能由 B 站官方包导入，未导入时回应与选择器没有任何表情。
-- 图片随前端静态资源发布（web/public/emoji-defaults，Twemoji CC-BY 4.0），不依赖上传目录。
-- 分组名避开 B 站官方包的「小黄脸」：导入脚本重建 source='bilibili' 分组时按名称唯一，撞名会使导入失败。
-- 名称带方括号：评论正文按 [名称] 占位符解析成图片。
WITH grp AS (
    INSERT INTO emoji_groups (name, source, sort_order, is_enabled, type, meta, cover_url)
    VALUES ('默认小黄脸', 'system', -100, true, 2, '{"size": 1}', '/emoji-defaults/1f60a.svg')
    ON CONFLICT (name) DO NOTHING
    RETURNING id
)
INSERT INTO emojis (group_id, name, url, text_content, sort_order)
SELECT grp.id, '[' || face.name || ']', '/emoji-defaults/' || face.code || '.svg', face.glyph, face.ord
FROM grp
CROSS JOIN (VALUES
    (1, '微笑', '1f60a', '😊'),
    (2, '大笑', '1f604', '😄'),
    (3, '笑哭', '1f602', '😂'),
    (4, '喜欢', '1f60d', '😍'),
    (5, '思考', '1f914', '🤔'),
    (6, '流泪', '1f622', '😢'),
    (7, '生气', '1f621', '😡'),
    (8, '庆祝', '1f973', '🥳'),
    (9, '笑翻', '1f923', '🤣'),
    (10, '飞吻', '1f618', '😘'),
    (11, '酷', '1f60e', '😎'),
    (12, '尴尬', '1f605', '😅'),
    (13, '大哭', '1f62d', '😭'),
    (14, '惊恐', '1f631', '😱'),
    (15, '睡觉', '1f634', '😴'),
    (16, '害羞', '1f633', '😳'),
    (17, '眨眼', '1f609', '😉'),
    (18, '无语', '1f611', '😑'),
    (19, '亲亲', '1f61a', '😚'),
    (20, '得意', '1f60f', '😏'),
    (21, '委屈', '1f97a', '🥺'),
    (22, '白眼', '1f644', '🙄'),
    (23, '偷笑', '1f92d', '🤭'),
    (24, '头晕', '1f635', '😵')
) AS face(ord, name, code, glyph);
