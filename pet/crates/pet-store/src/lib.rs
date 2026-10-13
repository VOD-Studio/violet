use pet_core::{Action, ActError, Pet};
use rusqlite::{Connection, OptionalExtension, TransactionBehavior};
use std::path::Path;

/// 作用域:世界 + 账号 subject,隔离不同接入方与账号。
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Scope {
    pub world: String,
    pub owner: String,
}

impl Scope {
    fn key(&self) -> String {
        format!("{}\u{1f}{}", self.world, self.owner)
    }
}

#[derive(Debug)]
pub struct Versioned {
    pub version: u64,
    pub state: String,
}

/// 一次原子提交的全部内容:新状态与命令结果同事务落库。
pub struct Changeset {
    pub state: String,
    pub result: String,
    /// 请求参数摘要;同一 request_id 换参数会被拒绝。
    pub params_hash: String,
}

#[derive(Debug, PartialEq, Eq)]
pub enum Commit {
    Committed { version: u64 },
    Replayed { result: String },
    Conflict { actual: u64 },
    RequestIdReused,
}

#[derive(Debug)]
pub enum StoreError {
    Db(rusqlite::Error),
}

impl From<rusqlite::Error> for StoreError {
    fn from(e: rusqlite::Error) -> Self {
        Self::Db(e)
    }
}

/// 存储契约:读取版本 + 单次原子提交。不暴露事务回调。
pub trait Store {
    fn load(&self, scope: &Scope) -> Result<Option<Versioned>, StoreError>;
    fn commit(&mut self, scope: &Scope, expected: u64, request_id: &str, cs: &Changeset) -> Result<Commit, StoreError>;
}

pub struct SqliteStore {
    conn: Connection,
}

impl SqliteStore {
    pub fn open(path: &Path) -> Result<Self, StoreError> {
        let conn = Connection::open(path)?;
        conn.busy_timeout(std::time::Duration::from_secs(10))?;
        conn.execute_batch(
            "PRAGMA journal_mode=WAL;
             CREATE TABLE IF NOT EXISTS pets(
               scope TEXT PRIMARY KEY, version INTEGER NOT NULL, state TEXT NOT NULL);
             CREATE TABLE IF NOT EXISTS requests(
               scope TEXT NOT NULL, request_id TEXT NOT NULL, params_hash TEXT NOT NULL,
               result TEXT NOT NULL CHECK(length(result) <= 65536),
               PRIMARY KEY(scope, request_id));",
        )?;
        Ok(Self { conn })
    }
}

impl Store for SqliteStore {
    fn load(&self, scope: &Scope) -> Result<Option<Versioned>, StoreError> {
        Ok(self
            .conn
            .query_row("SELECT version, state FROM pets WHERE scope=?1", [scope.key()], |r| {
                Ok(Versioned { version: r.get::<_, i64>(0)? as u64, state: r.get(1)? })
            })
            .optional()?)
    }

    fn commit(&mut self, scope: &Scope, expected: u64, request_id: &str, cs: &Changeset) -> Result<Commit, StoreError> {
        let key = scope.key();
        let tx = self.conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let prior: Option<(String, String)> = tx
            .query_row("SELECT params_hash, result FROM requests WHERE scope=?1 AND request_id=?2", [&key, request_id], |r| {
                Ok((r.get(0)?, r.get(1)?))
            })
            .optional()?;
        if let Some((hash, result)) = prior {
            return Ok(if hash == cs.params_hash { Commit::Replayed { result } } else { Commit::RequestIdReused });
        }
        let actual: u64 = tx
            .query_row("SELECT version FROM pets WHERE scope=?1", [&key], |r| r.get::<_, i64>(0))
            .optional()?
            .map_or(0, |v| v as u64);
        if actual != expected {
            return Ok(Commit::Conflict { actual });
        }
        let next = expected + 1;
        tx.execute(
            "INSERT INTO pets(scope, version, state) VALUES(?1, ?2, ?3)
             ON CONFLICT(scope) DO UPDATE SET version=excluded.version, state=excluded.state",
            rusqlite::params![key, next as i64, cs.state],
        )?;
        tx.execute(
            "INSERT INTO requests(scope, request_id, params_hash, result) VALUES(?1, ?2, ?3, ?4)",
            rusqlite::params![key, request_id, cs.params_hash, cs.result],
        )?;
        tx.commit()?;
        Ok(Commit::Committed { version: next })
    }
}

#[derive(Debug)]
pub enum ExecError {
    Store(StoreError),
    Act(ActError),
    NoPet,
    RequestIdReused,
    Corrupt,
}

impl From<StoreError> for ExecError {
    fn from(e: StoreError) -> Self {
        Self::Store(e)
    }
}

/// 动作执行外层:load → 规则核心 → 原子 commit;版本冲突时重读重试。
pub fn run_act<S: Store>(store: &mut S, scope: &Scope, action: Action, action_name: &str, now: u64, request_id: &str) -> Result<String, ExecError> {
    use sha2::{Digest, Sha256};
    let params_hash = format!("{:x}", Sha256::digest(format!("{action_name}:{now}")));
    for _ in 0..16 {
        let cur = store.load(scope)?.ok_or(ExecError::NoPet)?;
        let pet: Pet = serde_json::from_str(&cur.state).map_err(|_| ExecError::Corrupt)?;
        let out = pet_core::act(pet, action, now, request_id).map_err(ExecError::Act)?;
        let state = serde_json::to_string(&out.pet).map_err(|_| ExecError::Corrupt)?;
        let result = serde_json::to_string(&out).map_err(|_| ExecError::Corrupt)?;
        let cs = Changeset { state, result, params_hash: params_hash.clone() };
        match store.commit(scope, cur.version, request_id, &cs)? {
            Commit::Committed { .. } => return Ok(cs.result),
            Commit::Replayed { result } => return Ok(result),
            Commit::RequestIdReused => return Err(ExecError::RequestIdReused),
            Commit::Conflict { .. } => continue,
        }
    }
    Err(ExecError::Store(StoreError::Db(rusqlite::Error::InvalidQuery)))
}

/// 正式领取:以版本 0 提交,已有宠物则冲突。
pub fn seed<S: Store>(store: &mut S, scope: &Scope, pet: &Pet, request_id: &str) -> Result<Commit, StoreError> {
    let state = serde_json::to_string(pet).unwrap();
    store.commit(scope, 0, request_id, &Changeset { state: state.clone(), result: state, params_hash: "birth".into() })
}
