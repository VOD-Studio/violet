use ed25519_dalek::SigningKey;
use pet_core::proof::*;
use pet_issuer::issue_certificate;

fn key() -> SigningKey {
    SigningKey::from_bytes(&[7u8; 32])
}
fn ctx() -> Context {
    Context { world: "w1".into(), issuer: "violet".into(), request_id: "r1".into(), eligibility: "e".into(), rules_version: 1 }
}
fn cert() -> Certificate {
    issue_certificate(&key(), &ctx(), &[1u8; 32], &[2u8; 32]).unwrap()
}
fn pubkey() -> [u8; 32] {
    key().verifying_key().to_bytes()
}

#[test]
fn honest_certificate_verifies() {
    assert_eq!(verify(&cert(), &pubkey()), Verdict::Valid);
}

#[test]
fn tampering_is_classified() {
    let flip = |s: &str| format!("{}{}", if s.starts_with('0') { "1" } else { "0" }, &s[1..]);
    let mut c = cert();
    c.server_seed = flip(&c.server_seed);
    assert_eq!(verify(&c, &pubkey()), Verdict::CommitmentMismatch);

    let mut c = cert();
    c.client_seed = flip(&c.client_seed);
    assert_eq!(verify(&c, &pubkey()), Verdict::AcceptSignature);

    let mut c = cert();
    c.commit_sig = flip(&c.commit_sig);
    assert_eq!(verify(&c, &pubkey()), Verdict::CommitSignature);

    let mut c = cert();
    c.rarity = (c.rarity + 1) % 5;
    assert_eq!(verify(&c, &pubkey()), Verdict::ResultMismatch);

    let mut c = cert();
    c.context.world = "w2".into();
    assert_eq!(verify(&c, &pubkey()), Verdict::CommitSignature);

    let mut c = cert();
    c.context.rules_version = 2;
    assert_eq!(verify(&c, &pubkey()), Verdict::UnsupportedRules);

    let other = SigningKey::from_bytes(&[9u8; 32]).verifying_key().to_bytes();
    assert_eq!(verify(&cert(), &other), Verdict::CommitSignature);
}

#[test]
fn server_cannot_swap_server_seed_after_seeing_client_seed() {
    // 服务端在承诺后看到 client_seed,换一个 server_seed 重新生成结果:承诺不再匹配。
    let honest = cert();
    let mut c = issue_certificate(&key(), &ctx(), &[3u8; 32], &[2u8; 32]).unwrap();
    c.commitment = honest.commitment.clone();
    c.commit_sig = honest.commit_sig.clone();
    assert_eq!(verify(&c, &pubkey()), Verdict::CommitmentMismatch);
}

#[test]
fn certificate_carries_no_account_data() {
    let json = serde_json::to_string(&cert()).unwrap();
    assert!(!json.contains("@") && !json.contains("password"));
}
