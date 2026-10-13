//! 服务的 HTTP 层验收：完整请求经过路由、认证与真实 SQLite 文件存储。
use axum::body::Body;
use axum::http::{Request, StatusCode};
use axum::Router;
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use ed25519_dalek::{Signer, SigningKey};
use http_body_util::BodyExt;
use pet_core::proof::{verify, Certificate, IssuerKey, Verdict};
use pet_service::identity::TrustedIssuer;
use pet_service::{router, AppState, Config};
use pet_store::{Changeset, Scope, SqliteStore, Store};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tower::ServiceExt;

const T0: u64 = 1_800_000_000;
const AUD: &str = "pet-service-test";
const WORLD: &str = "world-a";

struct Env {
    app: Router,
    clock: Arc<AtomicU64>,
    db: PathBuf,
    violet: SigningKey,
    _dir: tempfile::TempDir,
}

fn hex32(b: u8) -> Vec<u8> {
    vec![b; 32]
}

fn issuer_keys(violet: &SigningKey, not_after: Option<u64>) -> Vec<TrustedIssuer> {
    let k: IssuerKey = serde_json::from_value(json!({
        "kid": "v1", "public_key": pet_core::hex(&violet.verifying_key().to_bytes()), "not_before": "0",
        "not_after": not_after.map(|n| n.to_string()),
    }))
    .unwrap();
    vec![TrustedIssuer { iss: "violet".into(), keys: vec![k] }]
}

fn state(db: &Path, clock: Arc<AtomicU64>, violet: &SigningKey, world: &str) -> Router {
    let signing = SigningKey::from_bytes(&[5u8; 32]);
    let published = vec![json!({"kid": "p1", "public_key": pet_core::hex(&signing.verifying_key().to_bytes()), "not_before": "0"})];
    let cfg = Config {
        world: world.into(),
        audience: AUD.into(),
        issuer_name: "pet-service".into(),
        kid: "p1".into(),
        issuers: issuer_keys(violet, None),
        token_secret: hex32(1),
        eligibility_secret: hex32(2),
        published_keys: published,
    };
    let path = db.to_path_buf();
    let c = clock.clone();
    let st = Arc::new(AppState {
        cfg,
        signing,
        new_store: Arc::new(move || SqliteStore::open(&path).unwrap()),
        clock: Arc::new(move || c.load(Ordering::SeqCst)),
        replay: Default::default(),
    });
    router(st)
}

fn env() -> Env {
    let dir = tempfile::tempdir().unwrap();
    let db = dir.path().join("pet.db");
    let clock = Arc::new(AtomicU64::new(T0));
    let violet = SigningKey::from_bytes(&[9u8; 32]);
    Env { app: state(&db, clock.clone(), &violet, WORLD), clock, db, violet, _dir: dir }
}

fn assertion_with(key: &SigningKey, claims: Value) -> String {
    let payload = serde_json::to_vec(&claims).unwrap();
    let mut msg = b"pet/assertion/v1\n".to_vec();
    msg.extend_from_slice(&payload);
    format!("v1.{}.{}", URL_SAFE_NO_PAD.encode(&payload), URL_SAFE_NO_PAD.encode(key.sign(&msg).to_bytes()))
}

fn claims(sub: &str, jti: &str, now: u64) -> Value {
    json!({"iss": "violet", "sub": sub, "aud": AUD, "kid": "v1", "jti": jti, "iat": now, "exp": now + 120})
}

async fn call(app: &Router, method: &str, uri: &str, token: Option<&str>, body: Option<Value>) -> (StatusCode, Value) {
    let mut req = Request::builder().method(method).uri(uri);
    if let Some(t) = token {
        req = req.header("authorization", format!("Bearer {t}"));
    }
    let req = match body {
        Some(b) => req.header("content-type", "application/json").body(Body::from(b.to_string())).unwrap(),
        None => req.body(Body::empty()).unwrap(),
    };
    let resp = app.clone().oneshot(req).await.unwrap();
    let status = resp.status();
    let bytes = resp.into_body().collect().await.unwrap().to_bytes();
    (status, serde_json::from_slice(&bytes).unwrap_or(Value::Null))
}

async fn login(e: &Env, sub: &str) -> String {
    let now = e.clock.load(Ordering::SeqCst);
    let jti = format!("{sub}-{now}-{}", rand_suffix());
    let (s, v) = call(&e.app, "POST", "/v1/auth/exchange", None, Some(json!({"assertion": assertion_with(&e.violet, claims(sub, &jti, now))}))).await;
    assert_eq!(s, StatusCode::OK, "{v}");
    v["value"]["access_token"].as_str().unwrap().to_string()
}

fn rand_suffix() -> u64 {
    static N: AtomicU64 = AtomicU64::new(0);
    N.fetch_add(1, Ordering::SeqCst)
}

fn seed(b: u8) -> String {
    format!("{b:02x}").repeat(32)
}

/// 完整领取一只宠物，返回（出生标识，响应值）。
async fn adopt(e: &Env, token: &str, client: u8) -> (String, Value) {
    let (s, v) = call(&e.app, "POST", "/v1/births", Some(token), None).await;
    assert_eq!(s, StatusCode::CREATED, "{v}");
    let id = v["value"]["request_id"].as_str().unwrap().to_string();
    let (s, v) = call(&e.app, "POST", &format!("/v1/births/{id}/accept"), Some(token), Some(json!({"client_seed": seed(client)}))).await;
    assert_eq!(s, StatusCode::OK, "{v}");
    (id, v["value"].clone())
}

// ---------------------------------------------------------------- 公开入口

#[tokio::test]
async fn public_endpoints_work_without_credentials() {
    let e = env();
    let (s, _) = call(&e.app, "GET", "/healthz", None, None).await;
    assert_eq!(s, StatusCode::OK);
    let (s, v) = call(&e.app, "GET", "/v1/capabilities", None, None).await;
    assert_eq!(s, StatusCode::OK);
    assert!(v["value"]["capabilities"].as_array().unwrap().iter().any(|c| c["op"] == "act"));
    let (s, v) = call(&e.app, "GET", "/v1/issuer-keys", None, None).await;
    assert_eq!((s, v["value"][0]["kid"].as_str()), (StatusCode::OK, Some("p1")));
}

#[tokio::test]
async fn private_endpoints_require_a_valid_token() {
    let e = env();
    for (m, u) in [("GET", "/v1/pets/me"), ("POST", "/v1/births"), ("GET", "/v1/pets/me/evolution"), ("POST", "/v1/pets/me/actions")] {
        let (s, v) = call(&e.app, m, u, None, Some(json!({}))).await;
        assert_eq!(s, StatusCode::UNAUTHORIZED, "{m} {u}");
        assert_eq!(v["code"], "unauthorized");
    }
    let (s, _) = call(&e.app, "GET", "/v1/pets/me", Some("t1.garbage.garbage"), None).await;
    assert_eq!(s, StatusCode::UNAUTHORIZED);
    let (s, _) = call(&e.app, "GET", "/v1/pets/me", Some("not-a-token"), None).await;
    assert_eq!(s, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn tokens_expire() {
    let e = env();
    let t = login(&e, "u1").await;
    let (s, _) = call(&e.app, "GET", "/v1/pets/me", Some(&t), None).await;
    assert_eq!(s, StatusCode::NOT_FOUND, "valid token, just no pet yet");
    e.clock.fetch_add(3601, Ordering::SeqCst);
    let (s, _) = call(&e.app, "GET", "/v1/pets/me", Some(&t), None).await;
    assert_eq!(s, StatusCode::UNAUTHORIZED);
}

// ---------------------------------------------------------------- 身份断言

#[tokio::test]
async fn bad_assertions_are_rejected_with_distinct_codes() {
    let e = env();
    let now = T0;
    let other = SigningKey::from_bytes(&[77u8; 32]);
    let mut wrong_aud = claims("u", "a1", now);
    wrong_aud["aud"] = json!("someone-else");
    let mut expired = claims("u", "a2", now - 1000);
    expired["exp"] = json!(now - 500);
    let mut long = claims("u", "a3", now);
    long["exp"] = json!(now + 100_000);
    let mut unknown_iss = claims("u", "a4", now);
    unknown_iss["iss"] = json!("evil");
    let mut unknown_kid = claims("u", "a5", now);
    unknown_kid["kid"] = json!("zzz");
    let future = claims("u", "a6", now + 10_000);

    let cases: Vec<(&str, String)> = vec![
        ("wrong_audience", assertion_with(&e.violet, wrong_aud)),
        ("assertion_expired", assertion_with(&e.violet, expired)),
        ("assertion_too_long_lived", assertion_with(&e.violet, long)),
        ("unknown_issuer", assertion_with(&e.violet, unknown_iss)),
        ("unknown_key", assertion_with(&e.violet, unknown_kid)),
        ("assertion_not_yet_valid", assertion_with(&e.violet, future)),
        ("bad_signature", assertion_with(&other, claims("u", "a7", now))),
        ("malformed_assertion", "garbage".into()),
        ("malformed_assertion", "v1.a.b".into()),
    ];
    for (code, a) in cases {
        let (s, v) = call(&e.app, "POST", "/v1/auth/exchange", None, Some(json!({"assertion": a}))).await;
        assert_eq!((s, v["code"].as_str().unwrap_or("")), (StatusCode::UNAUTHORIZED, code), "{v}");
    }
}

#[tokio::test]
async fn an_assertion_cannot_be_replayed() {
    let e = env();
    let a = assertion_with(&e.violet, claims("u", "once", T0));
    let (s, _) = call(&e.app, "POST", "/v1/auth/exchange", None, Some(json!({"assertion": a.clone()}))).await;
    assert_eq!(s, StatusCode::OK);
    let (s, v) = call(&e.app, "POST", "/v1/auth/exchange", None, Some(json!({"assertion": a}))).await;
    assert_eq!((s, v["code"].as_str()), (StatusCode::UNAUTHORIZED, Some("assertion_replayed")));
}

#[tokio::test]
async fn a_key_used_outside_its_window_is_rejected() {
    let e = env();
    // 发行者密钥在 T0 - 10 结束使用：之后签发的断言无效。
    let signing = SigningKey::from_bytes(&[5u8; 32]);
    let mut cfg_issuers = issuer_keys(&e.violet, Some(T0 - 10));
    let _ = &mut cfg_issuers;
    let path = e.db.clone();
    let clock = e.clock.clone();
    let cfg = Config {
        world: WORLD.into(),
        audience: AUD.into(),
        issuer_name: "pet-service".into(),
        kid: "p1".into(),
        issuers: cfg_issuers,
        token_secret: hex32(1),
        eligibility_secret: hex32(2),
        published_keys: vec![],
    };
    let app = router(Arc::new(AppState { cfg, signing, new_store: Arc::new(move || SqliteStore::open(&path).unwrap()), clock: Arc::new(move || clock.load(Ordering::SeqCst)), replay: Default::default() }));
    let (s, v) = call(&app, "POST", "/v1/auth/exchange", None, Some(json!({"assertion": assertion_with(&e.violet, claims("u", "w1", T0))}))).await;
    assert_eq!((s, v["code"].as_str()), (StatusCode::UNAUTHORIZED, Some("key_not_valid")));
}

// ---------------------------------------------------------------- 领取

#[tokio::test]
async fn adoption_issues_a_certificate_anyone_can_verify() {
    let e = env();
    let t = login(&e, "alice").await;
    let (_, accepted) = adopt(&e, &t, 3).await;
    let cert: Certificate = serde_json::from_value(accepted["certificate"].clone()).unwrap();
    // 验证者只需要公开的密钥集。
    let (_, keys) = call(&e.app, "GET", "/v1/issuer-keys", None, None).await;
    let keys: Vec<IssuerKey> = serde_json::from_value(keys["value"].clone()).unwrap();
    assert_eq!(verify(&cert, &keys), Verdict::Valid);
    assert_eq!(cert.id, accepted["pet"]["pet"]["id"].as_str().unwrap(), "the certificate describes the pet that was created");
    // 证书里没有账号标识。
    let text = accepted["certificate"].to_string();
    assert!(!text.contains("alice") && !text.contains("violet"));
}

#[tokio::test]
async fn the_server_seed_is_never_exposed_before_the_certificate() {
    let e = env();
    let t = login(&e, "alice").await;
    let (_, v) = call(&e.app, "POST", "/v1/births", Some(&t), None).await;
    let id = v["value"]["request_id"].as_str().unwrap();
    let (_, view) = call(&e.app, "GET", &format!("/v1/births/{id}"), Some(&t), None).await;
    for body in [v.to_string(), view.to_string()] {
        assert!(!body.contains("server_seed"), "{body}");
    }
    assert_eq!(view["value"]["state"], "committed");
    assert_eq!(view["value"]["commitment"], v["value"]["commitment"]);
}

#[tokio::test]
async fn accepting_twice_returns_the_same_result_and_the_seed_cannot_change() {
    let e = env();
    let t = login(&e, "alice").await;
    let (id, first) = adopt(&e, &t, 3).await;
    let (s, again) = call(&e.app, "POST", &format!("/v1/births/{id}/accept"), Some(&t), Some(json!({"client_seed": seed(3)}))).await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(again["value"]["certificate"], first["certificate"], "a retry gets the identical certificate");
    let (s, v) = call(&e.app, "POST", &format!("/v1/births/{id}/accept"), Some(&t), Some(json!({"client_seed": seed(4)}))).await;
    assert_eq!((s, v["code"].as_str()), (StatusCode::CONFLICT, Some("client_seed_fixed")));
}

#[tokio::test]
async fn a_service_restart_does_not_reroll_the_birth() {
    let e = env();
    let t = login(&e, "alice").await;
    let (_, created) = call(&e.app, "POST", "/v1/births", Some(&t), None).await;
    let id = created["value"]["request_id"].as_str().unwrap().to_string();
    let commitment = created["value"]["commitment"].clone();

    // 新的服务实例（同一份存储、同一套配置）：模拟进程重启。
    let restarted = state(&e.db, e.clock.clone(), &e.violet, WORLD);
    let (s, v) = call(&restarted, "GET", &format!("/v1/births/{id}"), Some(&t), None).await;
    assert_eq!((s, &v["value"]["commitment"]), (StatusCode::OK, &commitment));
    let (s, v) = call(&restarted, "POST", &format!("/v1/births/{id}/accept"), Some(&t), Some(json!({"client_seed": seed(8)}))).await;
    assert_eq!(s, StatusCode::OK, "{v}");
    let cert: Certificate = serde_json::from_value(v["value"]["certificate"].clone()).unwrap();
    assert_eq!(cert.commitment, commitment.as_str().unwrap(), "the reveal matches the commitment published before the restart");
}

#[tokio::test]
async fn only_one_living_main_pet_per_account() {
    let e = env();
    let t = login(&e, "alice").await;
    adopt(&e, &t, 3).await;
    let (s, v) = call(&e.app, "POST", "/v1/births", Some(&t), None).await;
    assert_eq!((s, v["code"].as_str()), (StatusCode::CONFLICT, Some("already_has_pet")));
}

#[tokio::test]
async fn racing_accepts_with_the_same_seed_create_exactly_one_pet() {
    let e = env();
    let t = login(&e, "alice").await;
    let (_, v) = call(&e.app, "POST", "/v1/births", Some(&t), None).await;
    let id = v["value"]["request_id"].as_str().unwrap().to_string();
    let mut tasks = vec![];
    for _ in 0..6 {
        let (app, t, id) = (e.app.clone(), t.clone(), id.clone());
        tasks.push(tokio::spawn(async move { call(&app, "POST", &format!("/v1/births/{id}/accept"), Some(&t), Some(json!({"client_seed": seed(5)}))).await }));
    }
    let results: Vec<_> = futures_join(tasks).await;
    assert!(results.iter().all(|(s, _)| *s == StatusCode::OK), "{results:?}");
    let certs: std::collections::BTreeSet<String> = results.iter().map(|(_, v)| v["value"]["certificate"]["id"].to_string()).collect();
    assert_eq!(certs.len(), 1, "every racer sees the same individual");
}

async fn futures_join(tasks: Vec<tokio::task::JoinHandle<(StatusCode, Value)>>) -> Vec<(StatusCode, Value)> {
    let mut out = vec![];
    for t in tasks {
        out.push(t.await.unwrap());
    }
    out
}

#[tokio::test]
async fn after_a_pet_dies_a_new_one_can_be_adopted_and_the_old_one_is_kept_as_a_memorial() {
    let e = env();
    let t = login(&e, "alice").await;
    let (_, first) = adopt(&e, &t, 3).await;
    let old_id = first["pet"]["pet"]["id"].as_str().unwrap().to_string();

    // 直接在存储里让它走到死亡（死亡只来自被观察的持续失养，接口上无法跳过）。
    let mut store = SqliteStore::open(&e.db).unwrap();
    let sc = Scope { world: WORLD.into(), owner: "violet\u{1f}alice#pet".into() };
    let cur = store.load(&sc).unwrap().unwrap();
    let mut pet: pet_core::Pet = serde_json::from_str(&cur.state).unwrap();
    pet.neglect = 100_000;
    let state = serde_json::to_string(&pet).unwrap();
    store.commit(&sc, cur.version, "test-kill", &Changeset { state: state.clone(), result: state, params_hash: "k".into() }).unwrap();

    let (s, v) = call(&e.app, "GET", "/v1/pets/me", Some(&t), None).await;
    assert_eq!((s, v["value"]["phase"].as_str()), (StatusCode::OK, Some("dead")));
    let (s, v) = call(&e.app, "POST", "/v1/pets/me/actions", Some(&t), Some(json!({"action": "feed", "request_id": "r-dead"}))).await;
    assert_eq!((s, v["code"].as_str()), (StatusCode::CONFLICT, Some("dead")));

    let (_, second) = adopt(&e, &t, 4).await;
    assert_ne!(second["pet"]["pet"]["id"].as_str().unwrap(), old_id, "a new adoption is a new individual, never a revival");
    let memorial = store.load(&Scope { world: WORLD.into(), owner: format!("violet\u{1f}alice#memorial:{old_id}") }).unwrap();
    assert!(memorial.is_some(), "the previous individual is archived");
}

// ---------------------------------------------------------------- 隔离

#[tokio::test]
async fn accounts_and_worlds_cannot_see_each_other() {
    let e = env();
    let alice = login(&e, "alice").await;
    let bob = login(&e, "bob").await;
    let (id, _) = adopt(&e, &alice, 3).await;

    assert_eq!(call(&e.app, "GET", "/v1/pets/me", Some(&bob), None).await.0, StatusCode::NOT_FOUND, "bob has no pet of his own");
    assert_eq!(call(&e.app, "GET", &format!("/v1/births/{id}"), Some(&bob), None).await.0, StatusCode::NOT_FOUND, "guessing an id grants nothing");
    assert_eq!(call(&e.app, "POST", &format!("/v1/births/{id}/accept"), Some(&bob), Some(json!({"client_seed": seed(1)}))).await.0, StatusCode::NOT_FOUND);

    // 同一份存储里的另一个世界：同样的账号也看不到。
    let other_world = state(&e.db, e.clock.clone(), &e.violet, "world-b");
    let t = {
        let now = e.clock.load(Ordering::SeqCst);
        let (_, v) = call(&other_world, "POST", "/v1/auth/exchange", None, Some(json!({"assertion": assertion_with(&e.violet, claims("alice", "wb", now))}))).await;
        v["value"]["access_token"].as_str().unwrap().to_string()
    };
    assert_eq!(call(&other_world, "GET", "/v1/pets/me", Some(&t), None).await.0, StatusCode::NOT_FOUND, "same subject, other world");
}

// ---------------------------------------------------------------- 动作

#[tokio::test]
async fn actions_commit_replay_and_reject_conflicting_reuse() {
    let e = env();
    let t = login(&e, "alice").await;
    adopt(&e, &t, 3).await;
    let feed = json!({"action": "feed", "request_id": "r1"});
    let (s, first) = call(&e.app, "POST", "/v1/pets/me/actions", Some(&t), Some(feed.clone())).await;
    assert_eq!(s, StatusCode::OK, "{first}");
    assert_eq!(first["value"]["pet"]["food"], 4, "the cost was charged");

    // 跨过一分钟边界的重试仍然返回原结果，不会被误判为请求标识复用。
    e.clock.fetch_add(90, Ordering::SeqCst);
    let (s, again) = call(&e.app, "POST", "/v1/pets/me/actions", Some(&t), Some(feed)).await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(again, first, "a retry returns the stored result");
    let (_, pet) = call(&e.app, "GET", "/v1/pets/me", Some(&t), None).await;
    assert_eq!(pet["value"]["pet"]["food"], 4, "the retry did not charge twice");

    let (s, v) = call(&e.app, "POST", "/v1/pets/me/actions", Some(&t), Some(json!({"action": "rest", "request_id": "r1"}))).await;
    assert_eq!((s, v["code"].as_str()), (StatusCode::CONFLICT, Some("request_conflict")));
}

#[tokio::test]
async fn rejected_actions_report_their_reason_and_charge_nothing() {
    let e = env();
    let t = login(&e, "alice").await;
    adopt(&e, &t, 3).await;
    let (s, v) = call(&e.app, "POST", "/v1/pets/me/actions", Some(&t), Some(json!({"action": "heal", "request_id": "h1"}))).await;
    assert_eq!((s, v["code"].as_str()), (StatusCode::UNPROCESSABLE_ENTITY, Some("not_sick")));
    let (s, v) = call(&e.app, "POST", "/v1/pets/me/actions", Some(&t), Some(json!({"action": {"evolve": {"branch": "steady"}}, "request_id": "e1"}))).await;
    assert_eq!((s, v["code"].as_str()), (StatusCode::UNPROCESSABLE_ENTITY, Some("not_eligible")));
    let (s, v) = call(&e.app, "POST", "/v1/pets/me/actions", Some(&t), Some(json!({"action": "fly", "request_id": "x"}))).await;
    assert_eq!((s, v["code"].as_str()), (StatusCode::BAD_REQUEST, Some("bad_input")));
    let (s, _) = call(&e.app, "POST", "/v1/pets/me/actions", Some(&t), Some(json!({"action": "feed", "request_id": "bad id with spaces"}))).await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    let (_, pet) = call(&e.app, "GET", "/v1/pets/me", Some(&t), None).await;
    assert_eq!(pet["value"]["pet"]["food"], 5, "nothing was charged");
}

#[tokio::test]
async fn concurrent_requests_never_double_spend_the_inventory() {
    let e = env();
    let t = login(&e, "alice").await;
    adopt(&e, &t, 3).await;
    let mut tasks = vec![];
    for i in 0..12 {
        let (app, t) = (e.app.clone(), t.clone());
        tasks.push(tokio::spawn(async move { call(&app, "POST", "/v1/pets/me/actions", Some(&t), Some(json!({"action": "feed", "request_id": format!("c{i}")}))).await }));
    }
    let results = futures_join(tasks).await;
    let ok = results.iter().filter(|(s, _)| *s == StatusCode::OK).count();
    assert_eq!(ok, 5, "exactly the 5 owned food items can be spent: {:?}", results.iter().map(|(s, _)| s.as_u16()).collect::<Vec<_>>());
    let (_, pet) = call(&e.app, "GET", "/v1/pets/me", Some(&t), None).await;
    assert_eq!(pet["value"]["pet"]["food"], 0);
}

#[tokio::test]
async fn evolution_options_explain_what_is_missing() {
    let e = env();
    let t = login(&e, "alice").await;
    adopt(&e, &t, 3).await;
    let (s, v) = call(&e.app, "GET", "/v1/pets/me/evolution", Some(&t), None).await;
    assert_eq!(s, StatusCode::OK);
    let options = v["value"]["options"].as_array().unwrap();
    assert_eq!(options.len(), 3);
    assert!(options.iter().all(|o| o["eligible"] == false && o["missing"].as_array().unwrap().iter().any(|m| m["kind"] == "level")));
}

#[tokio::test]
async fn bad_client_seed_is_a_bad_request() {
    let e = env();
    let t = login(&e, "alice").await;
    let (_, v) = call(&e.app, "POST", "/v1/births", Some(&t), None).await;
    let id = v["value"]["request_id"].as_str().unwrap();
    for bad in ["zz", &"A".repeat(64), &"a".repeat(63)] {
        let (s, _) = call(&e.app, "POST", &format!("/v1/births/{id}/accept"), Some(&t), Some(json!({"client_seed": bad}))).await;
        assert_eq!(s, StatusCode::BAD_REQUEST, "{bad}");
    }
}

#[tokio::test]
async fn malformed_bodies_get_the_standard_error_format_after_authentication() {
    let e = env();
    let t = login(&e, "alice").await;
    let req = |token: Option<&str>, uri: &str, body: &str| {
        let mut r = Request::builder().method("POST").uri(uri.to_string()).header("content-type", "application/json");
        if let Some(t) = token {
            r = r.header("authorization", format!("Bearer {t}"));
        }
        r.body(Body::from(body.to_string())).unwrap()
    };
    // 已认证 + 畸形 JSON：统一格式的 400。
    let resp = e.app.clone().oneshot(req(Some(&t), "/v1/pets/me/actions", "{not json")).await.unwrap();
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    let v: Value = serde_json::from_slice(&resp.into_body().collect().await.unwrap().to_bytes()).unwrap();
    assert_eq!((v["ok"].as_bool(), v["code"].as_str()), (Some(false), Some("bad_input")));
    // 未认证 + 畸形 JSON：先 401，不泄露任何关于请求体的信息。
    let resp = e.app.clone().oneshot(req(None, "/v1/pets/me/actions", "{not json")).await.unwrap();
    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
    // 换成登录入口，畸形输入同样是统一格式。
    let resp = e.app.clone().oneshot(req(None, "/v1/auth/exchange", "nope")).await.unwrap();
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
}
