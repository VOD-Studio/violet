use ed25519_dalek::SigningKey;
use pet_core::hex;
use pet_core::proof::*;
use pet_issuer::issue_certificate;

fn key(seed: u8) -> SigningKey {
    SigningKey::from_bytes(&[seed; 32])
}

fn ctx(kid: &str, issued_at: u64) -> Context {
    Context { world: "w1".into(), issuer: "violet".into(), kid: kid.into(), request_id: "r1".into(), eligibility: "e".into(), rules_version: 1, issued_at }
}

fn ik(kid: &str, seed: u8, not_before: u64, not_after: Option<u64>, revoked_at: Option<u64>) -> IssuerKey {
    // 通过 JSON 构造,与线上形态一致(u64 以字符串编码)。
    serde_json::from_value(serde_json::json!({
        "kid": kid,
        "public_key": hex(&key(seed).verifying_key().to_bytes()),
        "not_before": not_before.to_string(),
        "not_after": not_after.map(|v| v.to_string()),
        "revoked_at": revoked_at.map(|v| v.to_string()),
    }))
    .unwrap()
}

fn cert(kid: &str, seed: u8, issued_at: u64) -> Certificate {
    issue_certificate(&key(seed), &ctx(kid, issued_at), &[1u8; 32], &[2u8; 32]).unwrap()
}

fn keys() -> Vec<IssuerKey> {
    vec![ik("k1", 7, 0, None, None)]
}

#[test]
fn honest_certificate_verifies() {
    assert_eq!(verify(&cert("k1", 7, 1000), &keys()), Verdict::Valid);
}

#[test]
fn tampering_is_classified() {
    let flip = |s: &str| format!("{}{}", if s.starts_with('0') { "1" } else { "0" }, &s[1..]);
    let mut c = cert("k1", 7, 1000);
    c.server_seed = flip(&c.server_seed);
    assert_eq!(verify(&c, &keys()), Verdict::CommitmentMismatch);

    let mut c = cert("k1", 7, 1000);
    c.client_seed = flip(&c.client_seed);
    assert_eq!(verify(&c, &keys()), Verdict::AcceptSignature);

    let mut c = cert("k1", 7, 1000);
    c.commit_sig = flip(&c.commit_sig);
    assert_eq!(verify(&c, &keys()), Verdict::CommitSignature);

    let mut c = cert("k1", 7, 1000);
    c.rarity = (c.rarity + 1) % 5;
    assert_eq!(verify(&c, &keys()), Verdict::ResultMismatch);

    let mut c = cert("k1", 7, 1000);
    c.context.world = "w2".into();
    assert_eq!(verify(&c, &keys()), Verdict::CommitSignature);

    let mut c = cert("k1", 7, 1000);
    c.context.rules_version = 2;
    assert_eq!(verify(&c, &keys()), Verdict::UnsupportedRules);

    // 签发时间被改动也会破坏签名,不能靠改时间躲过撤销。
    let mut c = cert("k1", 7, 1000);
    c.context.issued_at = 1;
    assert_eq!(verify(&c, &keys()), Verdict::CommitSignature);

    // 用另一把私钥签名但冒用 k1 的公钥
    assert_eq!(verify(&cert("k1", 9, 1000), &keys()), Verdict::CommitSignature);
}

#[test]
fn server_cannot_swap_server_seed_after_seeing_client_seed() {
    let honest = cert("k1", 7, 1000);
    let mut c = issue_certificate(&key(7), &ctx("k1", 1000), &[3u8; 32], &[2u8; 32]).unwrap();
    c.commitment = honest.commitment.clone();
    c.commit_sig = honest.commit_sig.clone();
    assert_eq!(verify(&c, &keys()), Verdict::CommitmentMismatch);
}

#[test]
fn certificate_carries_no_account_data() {
    let json = serde_json::to_string(&cert("k1", 7, 1000)).unwrap();
    assert!(!json.contains('@') && !json.contains("password"));
}

#[test]
fn unknown_kid_is_reported() {
    assert_eq!(verify(&cert("missing", 7, 1000), &keys()), Verdict::UnknownKey);
    assert_eq!(verify(&cert("k1", 7, 1000), &[]), Verdict::UnknownKey);
}

#[test]
fn rotation_keeps_old_certificates_verifiable() {
    // k1 在 5000 结束使用,k2 自 5001 起;旧证书在新密钥集下仍然有效(AC-19)。
    let set = vec![ik("k1", 7, 0, Some(5000), None), ik("k2", 8, 5001, None, None)];
    assert_eq!(verify(&cert("k1", 7, 1000), &set), Verdict::Valid);
    assert_eq!(verify(&cert("k2", 8, 6000), &set), Verdict::Valid);
}

#[test]
fn a_rotated_key_cannot_sign_after_its_window() {
    let set = vec![ik("k1", 7, 0, Some(5000), None), ik("k2", 8, 5001, None, None)];
    assert_eq!(verify(&cert("k1", 7, 5001), &set), Verdict::KeyNotValid);
    assert_eq!(verify(&cert("k2", 8, 5000), &set), Verdict::KeyNotValid);
}

#[test]
fn revocation_invalidates_only_certificates_issued_from_the_revocation_time() {
    let set = vec![ik("k1", 7, 0, None, Some(3000))];
    assert_eq!(verify(&cert("k1", 7, 2999), &set), Verdict::Valid);
    assert_eq!(verify(&cert("k1", 7, 3000), &set), Verdict::KeyRevoked);
    assert_eq!(verify(&cert("k1", 7, 9000), &set), Verdict::KeyRevoked);
}

#[test]
fn malformed_public_key_is_a_bad_encoding_not_a_panic() {
    let mut k = ik("k1", 7, 0, None, None);
    k.public_key = "zz".into();
    assert_eq!(verify(&cert("k1", 7, 1000), &[k]), Verdict::BadEncoding);
}
