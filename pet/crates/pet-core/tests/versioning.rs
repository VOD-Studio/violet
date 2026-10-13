//! 规则版本与历史出生的兼容性保障(AC-19)。
use pet_core::{act, derive_birth, Action, BirthInput, ErrorCode, Pet, RULES_VERSION};
use serde_json::Value;

#[test]
fn golden_births_never_change() {
    // 已出生的个体按保存的身份、基因与对应规则版本呈现,不能被后来的实现改写。
    // 修改出生派生必须提升 RULES_VERSION 并保留旧派生;不得重新生成这份文件来让测试通过。
    let vectors: Vec<Value> = serde_json::from_str(include_str!("../../../scenario/golden-births.json")).unwrap();
    assert!(vectors.len() >= 16);
    for v in &vectors {
        assert_eq!(v["rules_version"].as_u64().unwrap(), 1, "only v1 vectors exist so far");
        let b = derive_birth(&BirthInput {
            world: v["world"].as_str().unwrap().into(),
            request_id: v["request_id"].as_str().unwrap().into(),
            server_seed: v["server_seed"].as_str().unwrap().into(),
            client_seed: v["client_seed"].as_str().unwrap().into(),
            born_at: 0,
        })
        .unwrap();
        let e = &v["expect"];
        assert_eq!(b.id, e["id"].as_str().unwrap(), "{}", v["request_id"]);
        assert_eq!(u64::from(b.rarity), e["rarity"].as_u64().unwrap());
        assert_eq!(u64::from(b.species), e["species"].as_u64().unwrap());
        let genes: Vec<u64> = e["genes"].as_array().unwrap().iter().map(|g| g.as_u64().unwrap()).collect();
        assert_eq!(b.genes.iter().map(|g| u64::from(*g)).collect::<Vec<_>>(), genes);
        let base: Vec<u64> = e["base_traits"].as_array().unwrap().iter().map(|g| g.as_u64().unwrap()).collect();
        assert_eq!(b.pet.growth.base_traits.iter().map(|g| u64::from(*g)).collect::<Vec<_>>(), base);
    }
}

#[test]
fn pets_saved_before_the_version_field_load_as_version_one() {
    let legacy = r#"{"id":"x","satiety":80,"energy":80,"food":5,"medicine":1,"neglect":"0","last_tick":"0","last_request":""}"#;
    let p: Pet = serde_json::from_str(legacy).unwrap();
    assert_eq!(p.rules_version, 1);
    assert_eq!((p.satiety_rem, p.energy_rem), (0, 0));
    assert!(act(p, Action::Wait, 10, "r").is_ok(), "legacy save must keep working");
}

#[test]
fn unknown_rules_version_is_rejected_not_guessed() {
    let mut p = Pet::newborn("p".into(), 0);
    p.rules_version = RULES_VERSION + 1;
    let e = act(p, Action::Wait, 10, "r").err().expect("must refuse");
    assert_eq!(e.code(), ErrorCode::UnsupportedRules);
}

#[test]
fn newborn_records_the_version_it_was_born_under() {
    assert_eq!(Pet::newborn("p".into(), 0).rules_version, RULES_VERSION);
}
