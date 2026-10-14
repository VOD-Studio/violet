//! 身份断言校验与服务访问令牌(ADR-0021)。断言由接入方(如 Violet)签发,服务只信任配置的发行者公钥。
use crate::util::{b64, hmac_sha256, unb64, verify_hmac};
use ed25519_dalek::{Signature, VerifyingKey};
use pet_core::proof::IssuerKey;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;

const ASSERTION_DOMAIN: &[u8] = b"pet/assertion/v1\n";
/// 断言有效期上限。
pub const MAX_ASSERTION_TTL: u64 = 300;
/// 允许的时钟偏差。
const SKEW: u64 = 30;
pub const TOKEN_TTL: u64 = 3600;

/// 一个受信任的发行者及其公钥集(支持轮换)。
#[derive(Clone, Deserialize)]
pub struct TrustedIssuer {
    pub iss: String,
    pub keys: Vec<IssuerKey>,
}

#[derive(Deserialize)]
struct Payload {
    iss: String,
    sub: String,
    aud: String,
    kid: String,
    jti: String,
    iat: u64,
    exp: u64,
}

/// 通过校验的主体。`iss` 与 `sub` 共同标识账号,不按邮箱或用户名合并。
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Subject {
    pub iss: String,
    pub sub: String,
}

impl Subject {
    pub fn owner_key(&self) -> String {
        format!("{}\u{1f}{}", self.iss, self.sub)
    }
}

#[derive(Debug, PartialEq, Eq)]
pub enum AssertionError {
    Malformed,
    UnknownIssuer,
    UnknownKey,
    KeyNotValid,
    BadSignature,
    WrongAudience,
    Expired,
    NotYetValid,
    TooLong,
    Replayed,
}

impl AssertionError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::Malformed => "malformed_assertion",
            Self::UnknownIssuer => "unknown_issuer",
            Self::UnknownKey => "unknown_key",
            Self::KeyNotValid => "key_not_valid",
            Self::BadSignature => "bad_signature",
            Self::WrongAudience => "wrong_audience",
            Self::Expired => "assertion_expired",
            Self::NotYetValid => "assertion_not_yet_valid",
            Self::TooLong => "assertion_too_long_lived",
            Self::Replayed => "assertion_replayed",
        }
    }
}

/// 已使用的断言标识,防止重放。进程内保存,多实例部署需要换成共享存储(见 pet/docs/service.md)。
#[derive(Default)]
pub struct ReplayGuard {
    seen: Mutex<HashMap<String, u64>>,
}

impl ReplayGuard {
    fn check_and_insert(&self, key: String, exp: u64, now: u64) -> bool {
        let mut seen = self.seen.lock().unwrap();
        seen.retain(|_, e| *e + SKEW >= now);
        seen.insert(key, exp).is_none()
    }
}

pub fn verify_assertion(raw: &str, issuers: &[TrustedIssuer], audience: &str, now: u64, replay: &ReplayGuard) -> Result<Subject, AssertionError> {
    let mut parts = raw.split('.');
    let (Some("v1"), Some(p), Some(s), None) = (parts.next(), parts.next(), parts.next(), parts.next()) else {
        return Err(AssertionError::Malformed);
    };
    let payload_bytes = unb64(p).ok_or(AssertionError::Malformed)?;
    let sig_bytes: [u8; 64] = unb64(s).and_then(|v| v.try_into().ok()).ok_or(AssertionError::Malformed)?;
    let payload: Payload = serde_json::from_slice(&payload_bytes).map_err(|_| AssertionError::Malformed)?;

    let issuer = issuers.iter().find(|i| i.iss == payload.iss).ok_or(AssertionError::UnknownIssuer)?;
    let key = issuer.keys.iter().find(|k| k.kid == payload.kid).ok_or(AssertionError::UnknownKey)?;
    if payload.iat < key.not_before || key.not_after.is_some_and(|e| payload.iat > e) || key.revoked_at.is_some_and(|r| payload.iat >= r) {
        return Err(AssertionError::KeyNotValid);
    }
    let pubkey: [u8; 32] = pet_core_unhex(&key.public_key).ok_or(AssertionError::UnknownKey)?;
    let vk = VerifyingKey::from_bytes(&pubkey).map_err(|_| AssertionError::UnknownKey)?;
    let mut msg = ASSERTION_DOMAIN.to_vec();
    msg.extend_from_slice(&payload_bytes);
    vk.verify_strict(&msg, &Signature::from_bytes(&sig_bytes)).map_err(|_| AssertionError::BadSignature)?;

    if payload.aud != audience {
        return Err(AssertionError::WrongAudience);
    }
    if payload.exp + SKEW < now {
        return Err(AssertionError::Expired);
    }
    if payload.iat > now + SKEW {
        return Err(AssertionError::NotYetValid);
    }
    if payload.exp < payload.iat || payload.exp - payload.iat > MAX_ASSERTION_TTL {
        return Err(AssertionError::TooLong);
    }
    if !replay.check_and_insert(format!("{}\u{1f}{}", payload.iss, payload.jti), payload.exp, now) {
        return Err(AssertionError::Replayed);
    }
    Ok(Subject { iss: payload.iss, sub: payload.sub })
}

fn pet_core_unhex(s: &str) -> Option<[u8; 32]> {
    if s.len() != 64 {
        return None;
    }
    let mut out = [0u8; 32];
    for (i, b) in out.iter_mut().enumerate() {
        *b = u8::from_str_radix(s.get(i * 2..i * 2 + 2)?, 16).ok()?;
    }
    Some(out)
}

#[derive(Serialize, Deserialize)]
struct TokenBody {
    iss: String,
    sub: String,
    exp: u64,
}

/// 签发服务访问令牌:无状态、带过期。撤销需要令牌存储,见 pet/docs/service.md。
pub fn issue_token(secret: &[u8], who: &Subject, now: u64) -> (String, u64) {
    let exp = now + TOKEN_TTL;
    let body = b64(&serde_json::to_vec(&TokenBody { iss: who.iss.clone(), sub: who.sub.clone(), exp }).unwrap());
    let tag = b64(&hmac_sha256(secret, &[b"pet/token/v1\n", body.as_bytes()]));
    (format!("t1.{body}.{tag}"), exp)
}

pub fn verify_token(secret: &[u8], raw: &str, now: u64) -> Option<Subject> {
    let mut it = raw.split('.');
    let (Some("t1"), Some(body), Some(tag), None) = (it.next(), it.next(), it.next(), it.next()) else {
        return None;
    };
    if !verify_hmac(secret, &[b"pet/token/v1\n", body.as_bytes()], &unb64(tag)?) {
        return None;
    }
    let b: TokenBody = serde_json::from_slice(&unb64(body)?).ok()?;
    (b.exp > now).then_some(Subject { iss: b.iss, sub: b.sub })
}
