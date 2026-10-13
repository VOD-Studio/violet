//! 出生承诺—揭示:承诺、接受收据、证书的签发与验证。
//! 本模块只含验证所需的数据结构与纯函数;签名密钥与签发在 pet-issuer,不进入核心。
use crate::birth::{derive_birth, BirthInput};
use crate::codec::{u64_string, unhex};
use crate::RULES_VERSION;
use alloc::string::String;
use alloc::vec::Vec;
use ed25519_dalek::{Signature, VerifyingKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

fn framed(parts: &[&[u8]]) -> Vec<u8> {
    let mut out = Vec::new();
    for p in parts {
        out.extend_from_slice(&(p.len() as u32).to_be_bytes());
        out.extend_from_slice(p);
    }
    out
}

fn digest(domain: &str, parts: &[&[u8]]) -> [u8; 32] {
    let mut h = Sha256::new();
    h.update(domain.as_bytes());
    h.update(framed(parts));
    h.finalize().into()
}

/// 本次领取固定的上下文:世界、发行者、请求、资格与规则摘要。
#[derive(Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "schema", derive(schemars::JsonSchema))]
pub struct Context {
    pub world: String,
    pub issuer: String,
    /// 签名密钥标识。验证方按它在密钥集中选择公钥,从而支持轮换。
    pub kid: String,
    pub request_id: String,
    /// 领取资格摘要,不含账号标识或原始活动。
    pub eligibility: String,
    pub rules_version: u32,
    /// 签发方声称的签发时间(逻辑时间)。它由签名保护但由签发方自报,
    /// 所以撤销被盗密钥时应取最早可能的泄露时间,见 pet/docs/birth-protocol.md。
    #[serde(with = "u64_string")]
    #[cfg_attr(feature = "schema", schemars(with = "String"))]
    pub issued_at: u64,
}

impl Context {
    fn bytes(&self) -> Vec<u8> {
        framed(&[
            self.world.as_bytes(),
            self.issuer.as_bytes(),
            self.kid.as_bytes(),
            self.request_id.as_bytes(),
            self.eligibility.as_bytes(),
            &self.rules_version.to_be_bytes(),
            &self.issued_at.to_be_bytes(),
        ])
    }
}

/// 验证方信任的一把签发公钥及其有效期。
#[derive(Clone, Deserialize)]
#[cfg_attr(feature = "schema", derive(schemars::JsonSchema))]
pub struct IssuerKey {
    pub kid: String,
    /// Ed25519 公钥,64 位十六进制。
    pub public_key: String,
    /// 自该时间起签发的证书有效(含)。
    #[serde(with = "u64_string")]
    #[cfg_attr(feature = "schema", schemars(with = "String"))]
    pub not_before: u64,
    /// 轮换后旧钥的结束时间(含);缺省表示仍在使用。已签发的旧证书在窗口内仍然有效。
    #[serde(default, with = "opt_u64_string")]
    #[cfg_attr(feature = "schema", schemars(with = "Option<String>"))]
    pub not_after: Option<u64>,
    /// 撤销时间:自该时间起(含)签发的证书无效,之前的证书不受影响。
    #[serde(default, with = "opt_u64_string")]
    #[cfg_attr(feature = "schema", schemars(with = "Option<String>"))]
    pub revoked_at: Option<u64>,
}

mod opt_u64_string {
    use alloc::string::{String, ToString};
    use serde::{de::Error, Deserialize, Deserializer, Serializer};

    // schemars 要求 with 模块成对提供 serialize;只有启用 schema feature 时才会被引用。
    #[cfg_attr(not(feature = "schema"), allow(dead_code))]
    pub fn serialize<S: Serializer>(v: &Option<u64>, s: S) -> Result<S::Ok, S::Error> {
        match v {
            Some(n) => s.serialize_some(&n.to_string()),
            None => s.serialize_none(),
        }
    }

    pub fn deserialize<'de, D: Deserializer<'de>>(d: D) -> Result<Option<u64>, D::Error> {
        match Option::<String>::deserialize(d)? {
            None => Ok(None),
            Some(s) => s.parse().map(Some).map_err(D::Error::custom),
        }
    }
}

pub fn commitment(ctx: &Context, server_seed: &[u8]) -> [u8; 32] {
    digest("pet/commit/v1", &[&ctx.bytes(), server_seed])
}

#[derive(Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "schema", derive(schemars::JsonSchema))]
pub struct Certificate {
    pub context: Context,
    /// 先于客户端随机材料公布。
    pub commitment: String,
    pub commit_sig: String,
    pub client_seed: String,
    /// 服务端承诺在先、接受客户端随机在后的签名收据。
    pub accept_sig: String,
    pub server_seed: String,
    pub id: String,
    pub rarity: u8,
    pub species: u8,
}

/// 承诺收据的待签消息。
pub fn commit_msg(ctx: &Context, c: &[u8]) -> [u8; 32] {
    digest("pet/receipt/commit/v1", &[&ctx.bytes(), c])
}

/// 接受收据的待签消息。
pub fn accept_msg(ctx: &Context, c: &[u8], client_seed: &[u8]) -> [u8; 32] {
    digest("pet/receipt/accept/v1", &[&ctx.bytes(), c, client_seed])
}

#[derive(Debug, PartialEq, Eq, Serialize)]
#[cfg_attr(feature = "schema", derive(schemars::JsonSchema))]
#[serde(rename_all = "snake_case")]
pub enum Verdict {
    Valid,
    UnsupportedRules,
    BadEncoding,
    CommitSignature,
    CommitmentMismatch,
    AcceptSignature,
    ResultMismatch,
    /// 密钥集中没有证书所标明的 kid。
    UnknownKey,
    /// 签发时间不在该密钥的有效窗口内。
    KeyNotValid,
    /// 签发时间不早于该密钥的撤销时间。
    KeyRevoked,
}

fn sig(s: &str) -> Option<Signature> {
    let b: [u8; 64] = unhex(s)?.try_into().ok()?;
    Some(Signature::from_bytes(&b))
}

/// 验证:来源签名、承诺与揭示一致、客户端随机在先被接受、结果可重算。
pub fn verify(cert: &Certificate, keys: &[IssuerKey]) -> Verdict {
    if cert.context.rules_version != RULES_VERSION {
        return Verdict::UnsupportedRules;
    }
    let Some(key) = keys.iter().find(|k| k.kid == cert.context.kid) else {
        return Verdict::UnknownKey;
    };
    let at = cert.context.issued_at;
    if at < key.not_before || key.not_after.is_some_and(|end| at > end) {
        return Verdict::KeyNotValid;
    }
    if key.revoked_at.is_some_and(|r| at >= r) {
        return Verdict::KeyRevoked;
    }
    let pubkey: Option<[u8; 32]> = unhex(&key.public_key).and_then(|v| v.try_into().ok());
    let (Some(Ok(vk)), Some(ss), Some(cs), Some(cm)) = (
        pubkey.map(|k| VerifyingKey::from_bytes(&k)),
        unhex(&cert.server_seed),
        unhex(&cert.client_seed),
        unhex(&cert.commitment),
    ) else {
        return Verdict::BadEncoding;
    };
    let (Some(commit_sig), Some(accept_sig)) = (sig(&cert.commit_sig), sig(&cert.accept_sig)) else {
        return Verdict::BadEncoding;
    };
    let ctx = &cert.context;
    if vk.verify_strict(&commit_msg(ctx, &cm), &commit_sig).is_err() {
        return Verdict::CommitSignature;
    }
    if commitment(ctx, &ss).as_slice() != cm.as_slice() {
        return Verdict::CommitmentMismatch;
    }
    if vk.verify_strict(&accept_msg(ctx, &cm, &cs), &accept_sig).is_err() {
        return Verdict::AcceptSignature;
    }
    let Ok(b) = derive_birth(&BirthInput {
        world: ctx.world.clone(),
        request_id: ctx.request_id.clone(),
        server_seed: cert.server_seed.clone(),
        client_seed: cert.client_seed.clone(),
        born_at: 0,
    }) else {
        return Verdict::BadEncoding;
    };
    if (b.id, b.rarity, b.species) != (cert.id.clone(), cert.rarity, cert.species) {
        return Verdict::ResultMismatch;
    }
    Verdict::Valid
}
