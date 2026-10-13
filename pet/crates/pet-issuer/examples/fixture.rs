//! 生成验证场景的证书夹具(固定测试密钥,仅用于一致性测试)。
use ed25519_dalek::SigningKey;
use pet_core::hex;
use pet_core::proof::*;
use pet_issuer::issue_certificate;

fn main() {
    let key = SigningKey::from_bytes(&[7u8; 32]);
    let ctx = Context {
        world: "w1".into(),
        issuer: "violet".into(),
        kid: "k1".into(),
        request_id: "r1".into(),
        eligibility: "e".into(),
        rules_version: 1,
        issued_at: 1000,
    };
    let cert = issue_certificate(&key, &ctx, &[1u8; 32], &[2u8; 32]).unwrap();
    let keys = serde_json::json!([{ "kid": "k1", "public_key": hex(&key.verifying_key().to_bytes()), "not_before": "0" }]);
    println!("{}", serde_json::json!({ "certificate": cert, "issuer_keys": keys }));
}
