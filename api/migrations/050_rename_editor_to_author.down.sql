-- 反向：将 author 角色恢复为 editor
UPDATE roles SET name = 'editor', description = '编辑'
WHERE name = 'author';
