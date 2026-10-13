use pet_core::{derive_birth, BirthInput};

fn input(req: &str, server: u8, client: u8) -> BirthInput {
    BirthInput {
        world: "w1".into(),
        request_id: req.into(),
        server_seed: format!("{server:02x}").repeat(32),
        client_seed: format!("{client:02x}").repeat(32),
        born_at: 0,
    }
}

#[test]
fn birth_is_reproducible_and_input_bound() {
    let a = derive_birth(&input("r1", 1, 2)).unwrap();
    let b = derive_birth(&input("r1", 1, 2)).unwrap();
    assert_eq!((a.id.clone(), a.genes), (b.id, b.genes));
    for tampered in [input("r2", 1, 2), input("r1", 3, 2), input("r1", 1, 4)] {
        assert_ne!(a.id, derive_birth(&tampered).unwrap().id);
    }
}

#[test]
fn rarity_follows_configured_weights() {
    let n = 20_000u32;
    let mut buckets = [0u32; 5];
    for i in 0..n {
        let inp = BirthInput { request_id: format!("req-{i}"), ..input("", 7, 9) };
        buckets[derive_birth(&inp).unwrap().rarity as usize] += 1;
    }
    let expect_bp = [6000u32, 2500, 1000, 400, 100];
    for (got, bp) in buckets.iter().zip(expect_bp) {
        let want = n * bp / 10_000;
        let tol = want / 8 + 10;
        assert!(got.abs_diff(want) <= tol, "bucket {got} vs {want} (tol {tol}): {buckets:?}");
    }
}

#[test]
fn bad_seed_is_rejected() {
    let mut inp = input("r1", 1, 2);
    inp.server_seed = "zz".into();
    assert!(derive_birth(&inp).is_err());
}
