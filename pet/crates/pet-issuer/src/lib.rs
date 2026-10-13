//! 出生证书签发。持有签名密钥,只用于服务端与测试;核心不依赖本 crate。
use ed25519_dalek::{Signer, SigningKey};
use pet_core::proof::{accept_msg, commit_msg, commitment, Certificate, Context};
use pet_core::{derive_birth, hex, BirthInput};

/// 第一步:对承诺签名并公布。
pub fn issue_commit(key: &SigningKey, ctx: &Context, server_seed: &[u8]) -> (String, String) {
    let c = commitment(ctx, server_seed);
    (hex(&c), hex(&key.sign(&commit_msg(ctx, &c)).to_bytes()))
}

/// 第二步:客户端随机材料被持久固定后签发接受收据。
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
