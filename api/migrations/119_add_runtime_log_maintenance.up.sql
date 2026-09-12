ALTER TABLE runtime_logs
    ADD COLUMN payload_bytes BIGINT GENERATED ALWAYS AS (
        32
        + octet_length(level)
        + octet_length(source)
        + octet_length(message)
        + octet_length(request_id)
        + octet_length(trace_id)
    ) STORED;

CREATE INDEX runtime_logs_received_at_idx ON runtime_logs (received_at, id);

CREATE TABLE runtime_log_usage (
    singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
    records BIGINT NOT NULL DEFAULT 0 CHECK (records >= 0),
    payload_bytes BIGINT NOT NULL DEFAULT 0 CHECK (payload_bytes >= 0),
    high_watermark BIGINT NOT NULL DEFAULT 0 CHECK (high_watermark >= 0)
);

INSERT INTO runtime_log_usage (singleton, records, payload_bytes, high_watermark)
SELECT TRUE, COUNT(*), COALESCE(SUM(payload_bytes), 0), COALESCE(MAX(id), 0)
FROM runtime_logs;

CREATE FUNCTION runtime_log_usage_after_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE runtime_log_usage
    SET records = records + (SELECT COUNT(*) FROM inserted),
        payload_bytes = payload_bytes
            + (SELECT COALESCE(SUM(payload_bytes), 0) FROM inserted),
        high_watermark = GREATEST(
            high_watermark,
            (SELECT COALESCE(MAX(id), 0) FROM inserted)
        );
    RETURN NULL;
END;
$$;

CREATE TRIGGER runtime_logs_usage_insert
AFTER INSERT ON runtime_logs
REFERENCING NEW TABLE AS inserted
FOR EACH STATEMENT
EXECUTE FUNCTION runtime_log_usage_after_insert();

CREATE FUNCTION runtime_log_usage_after_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE runtime_log_usage
    SET records = records - (SELECT COUNT(*) FROM deleted),
        payload_bytes = payload_bytes
            - (SELECT COALESCE(SUM(payload_bytes), 0) FROM deleted);
    RETURN NULL;
END;
$$;

CREATE TRIGGER runtime_logs_usage_delete
AFTER DELETE ON runtime_logs
REFERENCING OLD TABLE AS deleted
FOR EACH STATEMENT
EXECUTE FUNCTION runtime_log_usage_after_delete();

CREATE TABLE runtime_log_policy (
    singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
    version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
    retention_days INTEGER NOT NULL CHECK (retention_days BETWEEN 1 AND 3650),
    max_records BIGINT NOT NULL CHECK (max_records BETWEEN 100 AND 10000000),
    max_bytes BIGINT NOT NULL CHECK (max_bytes BETWEEN 1048576 AND 107374182400),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

INSERT INTO runtime_log_policy (singleton, retention_days, max_records, max_bytes)
VALUES (TRUE, 14, 200000, 268435456);
