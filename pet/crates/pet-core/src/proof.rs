//! 出生承诺—揭示:承诺、接受收据、证书的签发与验证。
//! 签发只给服务端与测试使用;验证器是纯函数,不读时钟、不访问网络。
use crate::birth::{derive_birth, BirthInput};
use crate::codec::{hex, unhex};
use crate::RULES_VERSION;
use alloc::string::String;
use alloc::vec::Vec;
use ed25519_dalek::{Signature, Signer, SigningKey, VerifyingKey};
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
    pub request_id: String,
    /// 领取资格摘要,不含账号标识或原始活动。
    pub eligibility: String,
    pub rules_version: u32,
}

impl Context {
    fn bytes(&self) -> Vec<u8> {
        framed(&[
            self.world.as_bytes(),
            self.issuer.as_bytes(),
            self.request_id.as_bytes(),
            self.eligibility.as_bytes(),
            &self.rules_version.to_be_bytes(),
        ])
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

fn commit_msg(ctx: &Context, c: &[u8]) -> [u8; 32] {
    digest("pet/receipt/commit/v1", &[&ctx.bytes(), c])
}

fn accept_msg(ctx: &Context, c: &[u8], client_seed: &[u8]) -> [u8; 32] {
    digest("pet/receipt/accept/v1", &[&ctx.bytes(), c, client_seed])
}

/// 第一步:服务端对承诺签名并公布。
pub fn issue_commit(key: &SigningKey, ctx: &Context, server_seed: &[u8]) -> (String, String) {
    let c = commitment(ctx, server_seed);
    (hex(&c), hex(&key.sign(&commit_msg(ctx, &c)).to_bytes()))
}

/// 第二步:服务端持久固定客户端随机材料后签发接受收据。
pub fn issue_accept(key: &SigningKey, ctx: &Context, server_seed: &[u8], client_seed: &[u8]) -> String {
    let c = commitment(ctx, server_seed);
    hex(&key.sign(&accept_msg(ctx, &c, client_seed)).to_bytes())
}

/// 第三步:揭示并装配证书。
pub fn issue_certificate(key: &SigningKey, ctx: &Context, server_seed: &[u8], client_seed: &[u8]) -> Result<Certificate, &'static str> {
    let (c, commit_sig) = issue_commit(key, ctx, server_seed);
    let accept_sig = issue_accept(key, ctx, server_seed, client_seed);
    let b = derive_birth(&BirthInput {
        world: ctx.world.clone(),
        request_id: ctx.request_id.clone(),
        server_seed: hex(server_seed),
        client_seed: hex(client_seed),
        born_at: 0,
    })?;
    Ok(Certificate {
        context: ctx.clone(),
        commitment: c,
        commit_sig,
        client_seed: hex(client_seed),
        accept_sig,
        server_seed: hex(server_seed),
        id: b.id,
        rarity: b.rarity,
        species: b.species,
    })
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
}

fn sig(s: &str) -> Option<Signature> {
    let b: [u8; 64] = unhex(s)?.try_into().ok()?;
    Some(Signature::from_bytes(&b))
}

/// 验证:来源签名、承诺与揭示一致、客户端随机在先被接受、结果可重算。
pub fn verify(cert: &Certificate, issuer_pub: &[u8; 32]) -> Verdict {
    if cert.context.rules_version != RULES_VERSION {
        return Verdict::UnsupportedRules;
    }
    let (Ok(vk), Some(ss), Some(cs), Some(cm)) = (
        VerifyingKey::from_bytes(issuer_pub),
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
