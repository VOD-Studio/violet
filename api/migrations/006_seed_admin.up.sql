-- 插入默认管理员用户
-- 密码: admin@2026 (bcrypt 哈希)
INSERT INTO users (username, email, password_hash, role, is_active, email_verified)
VALUES (
    'admin',
    'admin@gmail.com',
    '$2a$10$F/ZGl9XkdAWC22sj1JJSUe5GAfAJGev04trHFhsB8oPzF8rLdIKmy',
    'admin',
    true,
    true
)
ON CONFLICT (email) DO NOTHING;
