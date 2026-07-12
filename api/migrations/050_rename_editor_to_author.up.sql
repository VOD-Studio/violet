-- 将 editor 角色重命名为 author，并纳入内置角色体系
-- editor 此前无任何权限分配也无用户引用，重命名零数据损失
UPDATE roles SET name = 'author', description = '作者'
WHERE name = 'editor';

-- 若 editor 行不存在（新库或已迁移），补种 author，保证 author 角色一定存在
INSERT INTO roles (name, description) VALUES ('author', '作者')
ON CONFLICT (name) DO NOTHING;
