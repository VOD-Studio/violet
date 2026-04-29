-- 删除默认管理员用户
DELETE FROM users WHERE email = 'admin@gmail.com' AND username = 'admin';
