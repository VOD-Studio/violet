//! 生成验证场景的证书夹具(固定测试密钥,仅用于一致性测试)。
use ed25519_dalek::SigningKey;
use pet_core::proof::*;

fn main() {
    let key = SigningKey::from_bytes(&[7u8; 32]);
    let ctx = Context { world: "w1".into(), issuer: "violet".into(), request_id: "r1".into(), eligibility: "e".into(), rules_version: 1 };
    let cert = issue_certificate(&key, &ctx, &[1u8; 32], &[2u8; 32]).unwrap();
    let pk: String = key.verifying_key().to_bytes().iter().map(|b| format!("{b:02x}")).collect();
    println!("{}", serde_json::json!({ "certificate": cert, "issuer_pub": pk }));
}
