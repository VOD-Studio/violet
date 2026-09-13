-- Revert the security policy group. Explicit security overrides are dropped along
-- with the version row so the deployment env defaults take over again.
DELETE FROM site_settings WHERE key IN
    ('trusted_origins', 'trusted_proxies', 'cookie_secure', 'cookie_same_site', 'session_max_devices');
DELETE FROM site_settings_groups WHERE group_name = 'security';
