//! 独立宠物服务:持有账号宠物的唯一权威状态。不依赖 Violet 的 API、SSR 或数据库。
pub mod identity;
mod util;

use axum::body::Bytes;
use axum::extract::{Path, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use ed25519_dalek::SigningKey;
use identity::{issue_token, verify_assertion, verify_token, ReplayGuard, Subject, TrustedIssuer};
use pet_core::proof::{Certificate, Context};
use pet_core::{derive_birth, BirthInput, Pet, Phase, RULES_VERSION};
use pet_store::{Changeset, Commit, ExecError, Scope, Store, StoreError};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use util::{hmac_sha256, random_hex};

pub struct Config {
    /// 本服务实例所属的世界。不同世界互不可见。
    pub world: String,
    /// 断言必须面向的受众,防止别处签发的断言被拿来冒用。
    pub audience: String,
    /// 出生证书中的发行者名。
    pub issuer_name: String,
    /// 出生证书签名密钥的标识。
    pub kid: String,
    pub issuers: Vec<TrustedIssuer>,
    pub token_secret: Vec<u8>,
    pub eligibility_secret: Vec<u8>,
    /// 供验证者获取的出生证书公钥集(含轮换后的旧钥),原样公开。
    pub published_keys: Vec<Value>,
}

pub struct AppState<S: Store> {
    pub cfg: Config,
    pub signing: SigningKey,
    /// 每次操作取一个新连接,与存储契约测试的做法一致。
    pub new_store: Arc<dyn Fn() -> S + Send + Sync>,
    /// 当前 Unix 秒。逻辑时间由它换算,客户端不能指定时间。
    pub clock: Arc<dyn Fn() -> u64 + Send + Sync>,
    pub replay: ReplayGuard,
}

impl<S: Store> AppState<S> {
    fn secs(&self) -> u64 {
        (self.clock)()
    }
    fn ticks(&self) -> u64 {
        self.secs() / 60
    }
}

// ---------- 错误 ----------

pub struct ApiError {
    status: StatusCode,
    code: String,
    message: String,
}

impl ApiError {
    fn new(status: StatusCode, code: &str, message: &str) -> Self {
        Self { status, code: code.into(), message: message.into() }
    }
    fn unauthorized() -> Self {
        Self::new(StatusCode::UNAUTHORIZED, "unauthorized", "missing or invalid access token")
    }
    fn not_found(what: &str) -> Self {
        Self::new(StatusCode::NOT_FOUND, "not_found", what)
    }
    fn conflict(code: &str, message: &str) -> Self {
        Self::new(StatusCode::CONFLICT, code, message)
    }
    fn bad_request(code: &str, message: &str) -> Self {
        Self::new(StatusCode::BAD_REQUEST, code, message)
    }
    fn internal(e: impl std::fmt::Debug) -> Self {
        eprintln!("internal error: {e:?}");
        Self::new(StatusCode::INTERNAL_SERVER_ERROR, "internal", "internal error")
    }
}

impl From<StoreError> for ApiError {
    fn from(e: StoreError) -> Self {
        Self::internal(e)
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.status, Json(json!({"ok": false, "code": self.code, "message": self.message}))).into_response()
    }
}

fn ok(v: Value) -> Json<Value> {
    Json(json!({"ok": true, "value": v}))
}

// ---------- 作用域与记录 ----------

fn scope(st: &Config, who: &Subject, suffix: &str) -> Scope {
    Scope { world: st.world.clone(), owner: format!("{}#{suffix}", who.owner_key()) }
}

fn pet_scope(st: &Config, who: &Subject) -> Scope {
    scope(st, who, "pet")
}

#[derive(Serialize, Deserialize, Clone)]
struct BirthRecord {
    context: Context,
    /// 在揭示前保密,只存在于存储中,绝不通过接口返回。待加密存放见 pet/docs/service.md。
    server_seed: String,
    commitment: String,
    commit_sig: String,
    accepted: bool,
    client_seed: Option<String>,
    certificate: Option<Certificate>,
    pet_id: Option<String>,
}

fn valid_hex(s: &str, len: usize) -> bool {
    s.len() == len && s.bytes().all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
}

fn unhex(s: &str) -> Vec<u8> {
    (0..s.len() / 2).map(|i| u8::from_str_radix(&s[i * 2..i * 2 + 2], 16).unwrap_or(0)).collect()
}

fn valid_request_id(s: &str) -> bool {
    !s.is_empty() && s.len() <= 64 && s.bytes().all(|b| b.is_ascii_alphanumeric() || b"-_.:".contains(&b))
}

async fn with_store<S, T, F>(st: &Arc<AppState<S>>, f: F) -> Result<T, ApiError>
where
    S: Store + Send + 'static,
    T: Send + 'static,
    F: FnOnce(&AppState<S>, &mut S) -> Result<T, ApiError> + Send + 'static,
{
    let st = st.clone();
    tokio::task::spawn_blocking(move || {
        let mut store = (st.new_store)();
        f(&st, &mut store)
    })
    .await
    .map_err(ApiError::internal)?
}

/// 请求体解析放在认证之后，并且畸形输入也返回统一的错误格式。
fn parse_json<T: serde::de::DeserializeOwned>(body: &Bytes) -> Result<T, ApiError> {
    serde_json::from_slice(body).map_err(|e| ApiError::bad_request("bad_input", &format!("invalid JSON body: {e}")))
}

fn authed<S: Store>(st: &AppState<S>, headers: &HeaderMap) -> Result<Subject, ApiError> {
    let raw = headers.get(header::AUTHORIZATION).and_then(|v| v.to_str().ok()).and_then(|v| v.strip_prefix("Bearer ")).ok_or_else(ApiError::unauthorized)?;
    verify_token(&st.cfg.token_secret, raw, st.secs()).ok_or_else(ApiError::unauthorized)
}

/// 宠物在 `ticks` 时刻的投影。读取只结算展示，不写存储；死亡个体按存档原样展示。
fn project(pet: &Pet, ticks: u64, version: u64) -> Value {
    match pet_core::act(pet.clone(), pet_core::Action::Wait, ticks.max(pet.last_tick), "projection") {
        Ok(o) => json!({"pet": o.pet, "phase": o.phase, "mood": o.mood, "version": version}),
        Err(_) => json!({"pet": pet, "phase": Phase::Dead, "version": version}),
    }
}

fn is_dead(pet: &Pet, ticks: u64) -> bool {
    pet.phase() == Phase::Dead || pet_core::act(pet.clone(), pet_core::Action::Wait, ticks.max(pet.last_tick), "probe").is_err_and(|e| e.code() == pet_core::ErrorCode::Dead)
}

// ---------- 路由 ----------

pub fn router<S: Store + Send + 'static>(state: Arc<AppState<S>>) -> Router {
    Router::new()
        .route("/healthz", get(|| async { "ok" }))
        .route("/v1/capabilities", get(capabilities))
        .route("/v1/issuer-keys", get(issuer_keys::<S>))
        .route("/v1/auth/exchange", post(exchange::<S>))
        .route("/v1/births", post(create_birth::<S>))
        .route("/v1/births/{id}", get(get_birth::<S>))
        .route("/v1/births/{id}/accept", post(accept_birth::<S>))
        .route("/v1/pets/me", get(get_pet::<S>))
        .route("/v1/pets/me/actions", post(act::<S>))
        .route("/v1/pets/me/evolution", get(evolution::<S>))
        .with_state(state)
}

async fn capabilities() -> Json<Value> {
    ok(serde_json::to_value(pet_core::catalog()).unwrap())
}

async fn issuer_keys<S: Store + Send + 'static>(State(st): State<Arc<AppState<S>>>) -> Json<Value> {
    ok(Value::Array(st.cfg.published_keys.clone()))
}

#[derive(Deserialize)]
struct ExchangeBody {
    assertion: String,
}

async fn exchange<S: Store + Send + 'static>(State(st): State<Arc<AppState<S>>>, raw: Bytes) -> Result<Json<Value>, ApiError> {
    let body: ExchangeBody = parse_json(&raw)?;
    let now = st.secs();
    let who = verify_assertion(&body.assertion, &st.cfg.issuers, &st.cfg.audience, now, &st.replay)
        .map_err(|e| ApiError::new(StatusCode::UNAUTHORIZED, e.code(), "identity assertion rejected"))?;
    let (token, exp) = issue_token(&st.cfg.token_secret, &who, now);
    Ok(ok(json!({"access_token": token, "token_type": "Bearer", "expires_at": exp})))
}

// ---------- 出生：承诺 → 接受 → 揭示 ----------

async fn create_birth<S: Store + Send + 'static>(State(st): State<Arc<AppState<S>>>, headers: HeaderMap) -> Result<(StatusCode, Json<Value>), ApiError> {
    let who = authed(&st, &headers)?;
    let v = with_store(&st, move |st, store| {
        let ticks = st.ticks();
        if let Some(existing) = store.load(&pet_scope(&st.cfg, &who))? {
            let pet: Pet = serde_json::from_str(&existing.state).map_err(ApiError::internal)?;
            if !is_dead(&pet, ticks) {
                return Err(ApiError::conflict("already_has_pet", "this world already has a living main pet for the account"));
            }
        }
        let request_id = random_hex(16);
        let server_seed = random_hex(32);
        // 资格摘要对主体加盐哈希：只用于防重复，外部无法反推账号。
        let eligibility = pet_core::hex(&hmac_sha256(&st.cfg.eligibility_secret, &[who.owner_key().as_bytes()]));
        let ctx = Context {
            world: st.cfg.world.clone(),
            issuer: st.cfg.issuer_name.clone(),
            kid: st.cfg.kid.clone(),
            request_id: request_id.clone(),
            eligibility,
            rules_version: RULES_VERSION,
            issued_at: st.secs(),
        };
        let (commitment, commit_sig) = pet_issuer::issue_commit(&st.signing, &ctx, &unhex(&server_seed));
        let rec = BirthRecord { context: ctx.clone(), server_seed, commitment: commitment.clone(), commit_sig: commit_sig.clone(), accepted: false, client_seed: None, certificate: None, pet_id: None };
        let state = serde_json::to_string(&rec).map_err(ApiError::internal)?;
        let cs = Changeset { state: state.clone(), result: state, params_hash: "create".into() };
        match store.commit(&scope(&st.cfg, &who, &format!("birth:{request_id}")), 0, "create", &cs)? {
            Commit::Committed { .. } => {}
            other => return Err(ApiError::internal(other)),
        }
        Ok(json!({"request_id": request_id, "context": ctx, "commitment": commitment, "commit_sig": commit_sig}))
    })
    .await?;
    Ok((StatusCode::CREATED, ok(v)))
}

fn birth_view(rec: &BirthRecord) -> Value {
    // 未接受前只公开承诺；server_seed 永远不出现在这里，揭示靠证书。
    if rec.accepted {
        json!({"state": "accepted", "certificate": rec.certificate, "pet_id": rec.pet_id})
    } else {
        json!({"state": "committed", "context": rec.context, "commitment": rec.commitment, "commit_sig": rec.commit_sig})
    }
}

async fn get_birth<S: Store + Send + 'static>(State(st): State<Arc<AppState<S>>>, headers: HeaderMap, Path(id): Path<String>) -> Result<Json<Value>, ApiError> {
    let who = authed(&st, &headers)?;
    if !valid_hex(&id, 32) {
        return Err(ApiError::not_found("birth not found"));
    }
    let v = with_store(&st, move |st, store| {
        let rec = store.load(&scope(&st.cfg, &who, &format!("birth:{id}")))?.ok_or_else(|| ApiError::not_found("birth not found"))?;
        let rec: BirthRecord = serde_json::from_str(&rec.state).map_err(ApiError::internal)?;
        Ok(birth_view(&rec))
    })
    .await?;
    Ok(ok(v))
}

#[derive(Deserialize)]
struct AcceptBody {
    client_seed: String,
}

async fn accept_birth<S: Store + Send + 'static>(State(st): State<Arc<AppState<S>>>, headers: HeaderMap, Path(id): Path<String>, raw: Bytes) -> Result<Json<Value>, ApiError> {
    let who = authed(&st, &headers)?;
    let body: AcceptBody = parse_json(&raw)?;
    if !valid_hex(&id, 32) {
        return Err(ApiError::not_found("birth not found"));
    }
    if !valid_hex(&body.client_seed, 64) {
        return Err(ApiError::bad_request("bad_input", "client_seed must be 64 lowercase hex characters"));
    }
    let v = with_store(&st, move |st, store| accept(st, store, &who, &id, &body.client_seed)).await?;
    Ok(ok(v))
}

fn accept<S: Store>(st: &AppState<S>, store: &mut S, who: &Subject, id: &str, client_seed: &str) -> Result<Value, ApiError> {
    let birth_scope = scope(&st.cfg, who, &format!("birth:{id}"));
    let loaded = store.load(&birth_scope)?.ok_or_else(|| ApiError::not_found("birth not found"))?;
    let mut rec: BirthRecord = serde_json::from_str(&loaded.state).map_err(ApiError::internal)?;

    if rec.accepted {
        // 接受之后客户端随机材料已固定：同样的重试返回原结果，换了随机材料则拒绝。
        return if rec.client_seed.as_deref() == Some(client_seed) {
            Ok(accepted_view(store, st, who, &rec)?)
        } else {
            Err(ApiError::conflict("client_seed_fixed", "the client seed was already accepted and cannot change"))
        };
    }

    let ticks = st.ticks();
    let pet_scope = pet_scope(&st.cfg, who);
    let existing = store.load(&pet_scope)?;
    let mut expected = 0;
    if let Some(v) = &existing {
        let old: Pet = serde_json::from_str(&v.state).map_err(ApiError::internal)?;
        if !is_dead(&old, ticks) {
            return Err(ApiError::conflict("already_has_pet", "this world already has a living main pet for the account"));
        }
        // 已逝去的个体先归档为纪念，再被新个体替换；纪念保留名字、形象与经历。
        let memorial = scope(&st.cfg, who, &format!("memorial:{}", old.id));
        let cs = Changeset { state: v.state.clone(), result: "archived".into(), params_hash: "archive".into() };
        store.commit(&memorial, 0, "archive", &cs)?;
        expected = v.version;
    }

    let server_seed = unhex(&rec.server_seed);
    let client_bytes = unhex(client_seed);
    let cert = pet_issuer::issue_certificate(&st.signing, &rec.context, &server_seed, &client_bytes).map_err(|e| ApiError::bad_request("bad_input", e))?;
    let birth = derive_birth(&BirthInput {
        world: rec.context.world.clone(),
        request_id: rec.context.request_id.clone(),
        server_seed: rec.server_seed.clone(),
        client_seed: client_seed.into(),
        born_at: ticks,
    })
    .map_err(|e| ApiError::bad_request("bad_input", e))?;

    let pet_json = serde_json::to_string(&birth.pet).map_err(ApiError::internal)?;
    let cs = Changeset { state: pet_json.clone(), result: pet_json, params_hash: "adopt".into() };
    match store.commit(&pet_scope, expected, &format!("adopt:{id}"), &cs)? {
        Commit::Committed { .. } | Commit::Replayed { .. } => {}
        Commit::Conflict { .. } => {
            // 并发或重试：如果落库的正是这次出生的个体就继续，否则说明另一次领取先赢了。
            let now = store.load(&pet_scope)?.ok_or_else(|| ApiError::internal("pet vanished"))?;
            let p: Pet = serde_json::from_str(&now.state).map_err(ApiError::internal)?;
            if p.id != birth.id {
                return Err(ApiError::conflict("already_has_pet", "another adoption completed first"));
            }
        }
        Commit::RequestIdReused => return Err(ApiError::conflict("request_conflict", "adoption request id was reused")),
    }

    rec.accepted = true;
    rec.client_seed = Some(client_seed.into());
    rec.certificate = Some(cert);
    rec.pet_id = Some(birth.id.clone());
    let state = serde_json::to_string(&rec).map_err(ApiError::internal)?;
    let cs = Changeset { state: state.clone(), result: state, params_hash: pet_core::hex(&hmac_sha256(b"accept", &[client_seed.as_bytes()])) };
    match store.commit(&birth_scope, loaded.version, "accept", &cs)? {
        Commit::Committed { .. } | Commit::Replayed { .. } => {}
        Commit::Conflict { .. } => {
            // 另一次相同请求先写入了接受结果：以落库的为准。
            let again = store.load(&birth_scope)?.ok_or_else(|| ApiError::internal("birth vanished"))?;
            let stored: BirthRecord = serde_json::from_str(&again.state).map_err(ApiError::internal)?;
            if stored.client_seed.as_deref() != Some(client_seed) {
                return Err(ApiError::conflict("client_seed_fixed", "the client seed was already accepted and cannot change"));
            }
            return accepted_view(store, st, who, &stored);
        }
        Commit::RequestIdReused => return Err(ApiError::conflict("client_seed_fixed", "the client seed was already accepted and cannot change")),
    }
    accepted_view(store, st, who, &rec)
}

fn accepted_view<S: Store>(store: &mut S, st: &AppState<S>, who: &Subject, rec: &BirthRecord) -> Result<Value, ApiError> {
    let pet = store.load(&pet_scope(&st.cfg, who))?.map(|v| (serde_json::from_str::<Pet>(&v.state), v.version));
    let pet = match pet {
        Some((Ok(p), version)) => project(&p, st.ticks(), version),
        _ => Value::Null,
    };
    Ok(json!({"certificate": rec.certificate, "pet": pet}))
}

// ---------- 宠物 ----------

async fn get_pet<S: Store + Send + 'static>(State(st): State<Arc<AppState<S>>>, headers: HeaderMap) -> Result<Json<Value>, ApiError> {
    let who = authed(&st, &headers)?;
    let v = with_store(&st, move |st, store| {
        let v = store.load(&pet_scope(&st.cfg, &who))?.ok_or_else(|| ApiError::not_found("no pet"))?;
        let pet: Pet = serde_json::from_str(&v.state).map_err(ApiError::internal)?;
        Ok(project(&pet, st.ticks(), v.version))
    })
    .await?;
    Ok(ok(v))
}

#[derive(Deserialize)]
struct ActBody {
    action: Value,
    request_id: String,
}

async fn act<S: Store + Send + 'static>(State(st): State<Arc<AppState<S>>>, headers: HeaderMap, raw: Bytes) -> Result<Json<Value>, ApiError> {
    let who = authed(&st, &headers)?;
    let body: ActBody = parse_json(&raw)?;
    if !valid_request_id(&body.request_id) {
        return Err(ApiError::bad_request("bad_input", "request_id must be 1-64 characters of [A-Za-z0-9-_.:]"));
    }
    let action: pet_core::Action = serde_json::from_value(body.action.clone()).map_err(|e| ApiError::bad_request("bad_input", &e.to_string()))?;
    let action_text = body.action.to_string();
    let v = with_store(&st, move |st, store| {
        match pet_store::run_act(store, &pet_scope(&st.cfg, &who), action, &action_text, st.ticks(), &body.request_id) {
            Ok(result) => serde_json::from_str::<Value>(&result).map_err(ApiError::internal),
            Err(ExecError::NoPet) => Err(ApiError::not_found("no pet")),
            Err(ExecError::RequestIdReused) => Err(ApiError::conflict("request_conflict", "request_id was already used with different parameters")),
            Err(ExecError::Act(e)) => {
                let status = if e.code() == pet_core::ErrorCode::Dead { StatusCode::CONFLICT } else { StatusCode::UNPROCESSABLE_ENTITY };
                let code = serde_json::to_value(e.code()).unwrap_or_default();
                Err(ApiError::new(status, code.as_str().unwrap_or("rejected"), e.message()))
            }
            Err(other) => Err(ApiError::internal(other)),
        }
    })
    .await?;
    Ok(ok(v))
}

async fn evolution<S: Store + Send + 'static>(State(st): State<Arc<AppState<S>>>, headers: HeaderMap) -> Result<Json<Value>, ApiError> {
    let who = authed(&st, &headers)?;
    let v = with_store(&st, move |st, store| {
        let v = store.load(&pet_scope(&st.cfg, &who))?.ok_or_else(|| ApiError::not_found("no pet"))?;
        let pet: Pet = serde_json::from_str(&v.state).map_err(ApiError::internal)?;
        Ok(serde_json::to_value(pet_core::growth::evolution_options(&pet.growth, pet.food)).unwrap())
    })
    .await?;
    Ok(ok(v))
}
