-- 插入默认管理员用户
-- 密码: admin@2026 (bcrypt 哈希)
INSERT INTO users (username, email, password_hash, role, is_active, email_verified)
VALUES (
    'admin',
    'admin@gmail.com',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    'admin',
    true,
    true
)
ON CONFLICT (email) DO NOTHING;
