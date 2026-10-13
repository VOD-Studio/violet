use crate::{Changeset, Commit, Scope, Store, StoreError, Versioned};
use postgres::{Client, NoTls};

/// Postgres 实现。同一作用域的提交以事务级咨询锁串行化,语义与 SQLite 实现一致。
pub struct PgStore {
    client: Client,
}

impl PgStore {
    pub fn open(url: &str, schema: &str) -> Result<Self, StoreError> {
        assert!(schema.chars().all(|c| c.is_ascii_alphanumeric() || c == '_'), "schema name must be [A-Za-z0-9_]");
        let mut client = Client::connect(url, NoTls)?;
        // 迁移串行化:并发建表在 Postgres 中会因系统目录唯一约束竞争而失败。
        client.batch_execute("SELECT pg_advisory_lock(7001)")?;
        let res = client.batch_execute(&format!(
            "CREATE SCHEMA IF NOT EXISTS {schema};
             SET search_path TO {schema};
             CREATE TABLE IF NOT EXISTS pets(
               scope TEXT PRIMARY KEY, version BIGINT NOT NULL, state TEXT NOT NULL);
             CREATE TABLE IF NOT EXISTS requests(
               scope TEXT NOT NULL, request_id TEXT NOT NULL, params_hash TEXT NOT NULL,
               result TEXT NOT NULL CHECK(length(result) <= 65536),
               PRIMARY KEY(scope, request_id));"
        ));
        client.batch_execute("SELECT pg_advisory_unlock(7001)")?;
        res?;
        Ok(Self { client })
    }
}

impl Store for PgStore {
    fn load(&mut self, scope: &Scope) -> Result<Option<Versioned>, StoreError> {
        let row = self.client.query_opt("SELECT version, state FROM pets WHERE scope=$1", &[&scope.key()])?;
        Ok(row.map(|r| Versioned { version: r.get::<_, i64>(0) as u64, state: r.get(1) }))
    }

    fn commit(&mut self, scope: &Scope, expected: u64, request_id: &str, cs: &Changeset) -> Result<Commit, StoreError> {
        let key = scope.key();
        let mut tx = self.client.transaction()?;
        tx.execute("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", &[&key])?;
        if let Some(r) = tx.query_opt("SELECT params_hash, result FROM requests WHERE scope=$1 AND request_id=$2", &[&key, &request_id])? {
            let (hash, result): (String, String) = (r.get(0), r.get(1));
            return Ok(if hash == cs.params_hash { Commit::Replayed { result } } else { Commit::RequestIdReused });
        }
        let actual = tx.query_opt("SELECT version FROM pets WHERE scope=$1", &[&key])?.map_or(0, |r| r.get::<_, i64>(0) as u64);
        if actual != expected {
            return Ok(Commit::Conflict { actual });
        }
        let next = expected + 1;
        tx.execute(
            "INSERT INTO pets(scope, version, state) VALUES($1, $2, $3)
             ON CONFLICT(scope) DO UPDATE SET version=EXCLUDED.version, state=EXCLUDED.state",
            &[&key, &(next as i64), &cs.state],
        )?;
        tx.execute(
            "INSERT INTO requests(scope, request_id, params_hash, result) VALUES($1, $2, $3, $4)",
            &[&key, &request_id, &cs.params_hash, &cs.result],
        )?;
        tx.commit()?;
        Ok(Commit::Committed { version: next })
    }
}
