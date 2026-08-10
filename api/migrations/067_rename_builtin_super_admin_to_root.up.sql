-- users.is_builtin_super_admin → is_root
-- 统一为 root 用户语义，对齐 AWS root 的定位（权限系统的自救通道 + 主权操作持有者）。
-- 仅改名，语义不变：true 表示该用户是系统初始化的 root 用户。
ALTER TABLE users RENAME COLUMN is_builtin_super_admin TO is_root;
