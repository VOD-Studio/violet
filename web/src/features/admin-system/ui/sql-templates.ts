export const DEFAULT_SYSTEM_SQL = "SELECT now() AS server_time, current_database() AS database;";

export const LIST_TABLES_SQL = `SELECT schemaname AS schema_name,
       tablename AS table_name
FROM pg_catalog.pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;`;
