CREATE TABLE site_settings_groups (
    group_name varchar(40) PRIMARY KEY,
    version bigint NOT NULL DEFAULT 0 CHECK (version >= 0)
);
INSERT INTO site_settings_groups (group_name) VALUES
    ('general'), ('auth'), ('github'), ('profile'), ('about'), ('llm'), ('code-runner');

-- The footer is independent after this one-time migration. Never overwrite an explicit value.
INSERT INTO site_settings (key, value)
SELECT 'footer_github_url',
    CASE WHEN trim(value) ~ '^[A-Za-z0-9]([A-Za-z0-9-]{0,37}[A-Za-z0-9])?$'
         THEN 'https://github.com/' || trim(value)
         ELSE '' END
FROM site_settings WHERE key = 'github_username'
ON CONFLICT (key) DO NOTHING;
INSERT INTO site_settings (key, value) VALUES ('footer_github_url', '')
ON CONFLICT (key) DO NOTHING;

-- Legacy zero sentinels meant deployment defaults before the versioned contract.
DELETE FROM site_settings
WHERE key IN ('custom_emoji_max_per_user', 'code_runner_max_cpu_cores',
              'code_runner_max_memory_mb', 'code_runner_max_timeout_secs', 'code_runner_max_source_bytes')
  AND value ~ '^0([.]0+)?$';
