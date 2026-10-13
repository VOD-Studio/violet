//! 启动入口。配置全部来自环境变量，缺少必需项时直接退出并说明，不使用不安全的默认值。
use ed25519_dalek::SigningKey;
use pet_service::identity::TrustedIssuer;
use pet_service::{router, AppState, Config};
use pet_store::{PgStore, SqliteStore, Store};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

fn need(name: &str) -> String {
    std::env::var(name).unwrap_or_else(|_| {
        eprintln!("missing required environment variable {name}; see pet/docs/service.md");
        std::process::exit(2);
    })
}

fn hex32(name: &str) -> [u8; 32] {
    let v = need(name);
    let bytes: Option<Vec<u8>> = (v.len() == 64).then(|| (0..32).map(|i| u8::from_str_radix(&v[i * 2..i * 2 + 2], 16).ok()).collect::<Option<Vec<_>>>()).flatten();
    bytes.and_then(|b| b.try_into().ok()).unwrap_or_else(|| {
        eprintln!("{name} must be 64 hex characters");
        std::process::exit(2);
    })
}

fn config() -> (Config, SigningKey) {
    let signing = SigningKey::from_bytes(&hex32("PET_SIGNING_SEED"));
    let kid = need("PET_KID");
    let issuers: Vec<TrustedIssuer> = serde_json::from_str(&need("PET_TRUSTED_ISSUERS")).unwrap_or_else(|e| {
        eprintln!("PET_TRUSTED_ISSUERS is not valid: {e}");
        std::process::exit(2);
    });
    let mut published: Vec<serde_json::Value> = std::env::var("PET_PUBLISHED_KEYS").ok().and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default();
    if !published.iter().any(|k| k["kid"] == kid.as_str()) {
        published.push(serde_json::json!({"kid": kid, "public_key": pet_core::hex(&signing.verifying_key().to_bytes()), "not_before": "0"}));
    }
    let cfg = Config {
        world: need("PET_WORLD"),
        audience: need("PET_AUDIENCE"),
        issuer_name: need("PET_ISSUER_NAME"),
        kid,
        issuers,
        token_secret: hex32("PET_TOKEN_SECRET").to_vec(),
        eligibility_secret: hex32("PET_ELIGIBILITY_SECRET").to_vec(),
        published_keys: published,
    };
    (cfg, signing)
}

fn clock() -> Arc<dyn Fn() -> u64 + Send + Sync> {
    Arc::new(|| SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0))
}

async fn serve<S: Store + Send + 'static>(new_store: Arc<dyn Fn() -> S + Send + Sync>) {
    let (cfg, signing) = config();
    let state = Arc::new(AppState { cfg, signing, new_store, clock: clock(), replay: Default::default() });
    let addr = std::env::var("PET_LISTEN").unwrap_or_else(|_| "127.0.0.1:8787".into());
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap_or_else(|e| {
        eprintln!("cannot listen on {addr}: {e}");
        std::process::exit(1);
    });
    eprintln!("pet-service listening on {addr}");
    axum::serve(listener, router(state))
        .with_graceful_shutdown(async {
            let _ = tokio::signal::ctrl_c().await;
        })
        .await
        .expect("server error");
}

/// 预检在创建异步运行时之前完成：同步的 postgres 驱动内部自带运行时，不能在异步上下文里启动。
fn main() {
    let db = need("PET_DB");
    let runtime = || tokio::runtime::Builder::new_multi_thread().enable_all().build().expect("tokio runtime");
    if db.starts_with("postgres://") || db.contains("host=") {
        let schema = std::env::var("PET_DB_SCHEMA").unwrap_or_else(|_| "pet".into());
        // 启动时先建一次表，失败立即退出，而不是等到第一个请求。
        PgStore::open(&db, &schema).unwrap_or_else(|e| {
            eprintln!("cannot open postgres: {e:?}");
            std::process::exit(1);
        });
        runtime().block_on(serve::<PgStore>(Arc::new(move || PgStore::open(&db, &schema).expect("postgres connection"))));
    } else {
        let path = PathBuf::from(&db);
        SqliteStore::open(&path).unwrap_or_else(|e| {
            eprintln!("cannot open sqlite database {db}: {e:?}");
            std::process::exit(1);
        });
        runtime().block_on(serve::<SqliteStore>(Arc::new(move || SqliteStore::open(&path).expect("sqlite connection"))));
    }
}
