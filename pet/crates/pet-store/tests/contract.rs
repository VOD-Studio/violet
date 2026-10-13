use pet_core::{Action, Pet};
use pet_store::*;
use std::sync::{Arc, Barrier};

fn scope(w: &str, o: &str) -> Scope {
    Scope { world: w.into(), owner: o.into() }
}

fn pet(food: u32) -> Pet {
    let mut p = Pet::newborn("p1".into(), 0);
    p.food = food;
    p
}

fn load_pet(s: &SqliteStore, sc: &Scope) -> (u64, Pet) {
    let v = s.load(sc).unwrap().unwrap();
    (v.version, serde_json::from_str(&v.state).unwrap())
}

#[test]
fn stale_version_is_a_distinct_conflict_not_a_silent_overwrite() {
    let d = tempfile::tempdir().unwrap();
    let mut s = SqliteStore::open(&d.path().join("a.db")).unwrap();
    let sc = scope("w", "u");
    assert_eq!(seed(&mut s, &sc, &pet(3), "birth").unwrap(), Commit::Committed { version: 1 });
    let cs = Changeset { state: "{}".into(), result: "{}".into(), params_hash: "h".into() };
    assert_eq!(s.commit(&sc, 0, "x", &cs).unwrap(), Commit::Conflict { actual: 1 });
    assert_eq!(seed(&mut s, &sc, &pet(9), "birth2").unwrap(), Commit::Conflict { actual: 1 });
    assert_eq!(load_pet(&s, &sc).1.food, 3);
}

#[test]
fn replay_returns_committed_result_and_reused_id_is_rejected() {
    let d = tempfile::tempdir().unwrap();
    let mut s = SqliteStore::open(&d.path().join("a.db")).unwrap();
    let sc = scope("w", "u");
    seed(&mut s, &sc, &pet(3), "birth").unwrap();
    let first = run_act(&mut s, &sc, Action::Feed, "feed", 10, "r1").unwrap();
    let again = run_act(&mut s, &sc, Action::Feed, "feed", 10, "r1").unwrap();
    assert_eq!(first, again);
    assert_eq!(load_pet(&s, &sc).1.food, 2, "replay must not charge twice");
    assert!(matches!(run_act(&mut s, &sc, Action::Feed, "feed", 99, "r1"), Err(ExecError::RequestIdReused)));
}

#[test]
fn failed_commit_leaves_no_partial_state() {
    let d = tempfile::tempdir().unwrap();
    let mut s = SqliteStore::open(&d.path().join("a.db")).unwrap();
    let sc = scope("w", "u");
    seed(&mut s, &sc, &pet(3), "birth").unwrap();
    let before = s.load(&sc).unwrap().unwrap();
    // result 超出 CHECK 上限:状态已写入后结果表插入失败,整个事务必须回滚。
    let cs = Changeset { state: "{\"poison\":true}".into(), result: "x".repeat(70_000), params_hash: "h".into() };
    assert!(s.commit(&sc, before.version, "bad", &cs).is_err());
    let after = s.load(&sc).unwrap().unwrap();
    assert_eq!((after.version, after.state), (before.version, before.state));
    let cs = Changeset { state: after_state(&s, &sc), result: "ok".into(), params_hash: "h".into() };
    assert!(matches!(s.commit(&sc, 1, "bad", &cs).unwrap(), Commit::Committed { .. }), "failed request id was not consumed");
}

fn after_state(s: &SqliteStore, sc: &Scope) -> String {
    s.load(sc).unwrap().unwrap().state
}

#[test]
fn scopes_are_isolated() {
    let d = tempfile::tempdir().unwrap();
    let mut s = SqliteStore::open(&d.path().join("a.db")).unwrap();
    seed(&mut s, &scope("w1", "alice"), &pet(3), "b").unwrap();
    assert!(s.load(&scope("w2", "alice")).unwrap().is_none());
    assert!(s.load(&scope("w1", "bob")).unwrap().is_none());
    assert!(matches!(run_act(&mut s, &scope("w1", "bob"), Action::Feed, "feed", 1, "r"), Err(ExecError::NoPet)));
}

#[test]
fn concurrent_feeds_never_double_spend() {
    let d = tempfile::tempdir().unwrap();
    let path = d.path().join("a.db");
    let sc = scope("w", "u");
    {
        let mut s = SqliteStore::open(&path).unwrap();
        seed(&mut s, &sc, &pet(5), "birth").unwrap();
    }
    let threads = 8;
    let per = 3;
    let barrier = Arc::new(Barrier::new(threads));
    let handles: Vec<_> = (0..threads)
        .map(|t| {
            let (path, sc, barrier) = (path.clone(), sc.clone(), barrier.clone());
            std::thread::spawn(move || {
                let mut s = SqliteStore::open(&path).unwrap();
                barrier.wait();
                (0..per).filter(|i| run_act(&mut s, &sc, Action::Feed, "feed", 10, &format!("t{t}-{i}")).is_ok()).count()
            })
        })
        .collect();
    let ok: usize = handles.into_iter().map(|h| h.join().unwrap()).sum();
    let s = SqliteStore::open(&path).unwrap();
    let (version, p) = load_pet(&s, &sc);
    assert_eq!(ok, 5, "exactly the 5 owned food items can be spent");
    assert_eq!(p.food, 0);
    assert_eq!(version, 1 + 5);
}
