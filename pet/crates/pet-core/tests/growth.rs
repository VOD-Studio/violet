//! 成长规则:经验、性格漂移、进化、奖励(AC-06、AC-07)。
use pet_core::growth::{evolution_options, Branch, Growth, MissingKind, Stage, AFFECTION, CALM, CURIOUS, EVOLVE_FOOD_COST};
use pet_core::{act, derive_birth, grant, Action, BirthInput, ErrorCode, Mood, Outcome, Pet, Reward};

fn code(r: Result<Outcome, pet_core::ActError>) -> ErrorCode {
    r.err().expect("must be rejected").code()
}

fn do_act(p: Pet, a: Action, now: u64, id: &str) -> Pet {
    act(p, a, now, id).expect("accepted").pet
}

fn reward(exp: u16, topic: Option<&str>) -> Reward {
    Reward { exp, food: 0, medicine: 0, topic: topic.map(String::from) }
}

fn pet_at_level(exp: u32) -> Pet {
    let mut p = Pet::newborn("p".into(), 0);
    p.growth.exp = exp;
    p.food = 20;
    p
}

#[test]
fn levels_follow_thresholds() {
    for (exp, level) in [(0, 1), (19, 1), (20, 2), (49, 2), (50, 3), (299, 5), (300, 6), (1499, 9), (1500, 10)] {
        let g = Growth { exp, ..Growth::default() };
        assert_eq!(g.level(), level, "exp {exp}");
    }
}

#[test]
fn only_costly_actions_give_experience() {
    let mut p = Pet::newborn("p".into(), 0);
    let mut t = 0;
    // 休息与等待无成本,无论重复多少次都不得产生经验。
    for i in 0..200 {
        t += 1;
        p = do_act(p, if i % 2 == 0 { Action::Rest } else { Action::Wait }, t, &format!("n{i}"));
    }
    assert_eq!(p.growth.exp, 0);
    p = do_act(p, Action::Feed, t + 1, "feed");
    assert_eq!(p.growth.exp, 1);
    p = do_act(p, Action::Play, t + 2, "play");
    assert_eq!(p.growth.exp, 3);
}

#[test]
fn experience_is_capped() {
    let mut p = pet_at_level(1499);
    p = grant(p, &reward(100, None), 0, "g").unwrap().pet;
    assert_eq!(p.growth.exp, 1500);
}

#[test]
fn one_burst_cannot_rewrite_personality() {
    // 同一天内反复刺激同一维度,漂移不得超过每日预算。
    let mut p = Pet::newborn("p".into(), 0);
    let base = p.growth.base_traits;
    for i in 0..100u64 {
        p.energy = 100;
        p = do_act(p, Action::Play, 10 + i, &format!("p{i}"));
    }
    assert!(p.growth.traits[CURIOUS] - base[CURIOUS] <= 30, "drifted {}", p.growth.traits[CURIOUS] - base[CURIOUS]);
}

#[test]
fn sustained_experience_shapes_personality_but_keeps_the_birth_base() {
    let mut p = Pet::newborn("p".into(), 0);
    let base = p.growth.base_traits;
    for day in 0..60u64 {
        for i in 0..10u64 {
            p.energy = 100;
            p = do_act(p, Action::Play, day * 1440 + i, &format!("p{day}-{i}"));
        }
        p.food = 50;
        p.satiety = 100;
        p = do_act(p, Action::Feed, day * 1440 + 20, &format!("f{day}"));
    }
    let g = &p.growth;
    assert_eq!(g.base_traits, base, "birth base never changes");
    assert_eq!(g.traits[CURIOUS], base[CURIOUS] + 200, "capped at base + 200");
    assert_eq!(g.traits[AFFECTION], base[AFFECTION] + 200);
    assert_eq!(g.traits[CALM], base[CALM], "an unexercised trait stays at its base");
    assert!(g.traits.iter().zip(base).all(|(t, b)| *t >= b));
}

#[test]
fn hunger_alone_does_not_change_personality() {
    let mut p = Pet::newborn("p".into(), 0);
    let before = p.growth.traits;
    p = do_act(p, Action::Wait, 100 * 1440, "away"); // 离开三个月,生病
    assert_eq!(p.phase(), pet_core::Phase::Sick);
    assert_eq!(p.growth.traits, before);
}

#[test]
fn mood_is_derived_not_stored() {
    let mut p = Pet::newborn("p".into(), 0);
    assert_eq!(p.mood(), Mood::Happy);
    p.satiety = 10;
    assert_eq!(p.mood(), Mood::Hungry);
    p.satiety = 50;
    p.energy = 5;
    assert_eq!(p.mood(), Mood::Tired);
    p.energy = 50;
    assert_eq!(p.mood(), Mood::Content);
}

#[test]
fn newborn_cannot_evolve_and_missing_is_explained() {
    let p = pet_at_level(0);
    let o = evolution_options(&p.growth, p.food);
    assert_eq!(o.stage, Stage::Baby);
    assert_eq!(o.options.len(), 3);
    for opt in &o.options {
        assert!(!opt.eligible);
        let level = opt.missing.iter().find(|m| m.kind == MissingKind::Level).expect("level is missing");
        assert_eq!((level.have, level.need), (1, 3));
    }
    let curious = o.options.iter().find(|x| x.branch == Branch::Curious).unwrap();
    assert!(curious.missing.iter().any(|m| m.kind == MissingKind::Curious));
}

#[test]
fn rejected_evolution_costs_nothing() {
    let p = pet_at_level(0);
    let (food, exp) = (p.food, p.growth.exp);
    let r = act(p.clone(), Action::Evolve { branch: Branch::Steady }, 1, "e");
    assert_eq!(code(r), ErrorCode::NotEligible);
    assert_eq!((p.food, p.growth.exp), (food, exp));
}

#[test]
fn eligible_evolution_charges_once_and_is_idempotent() {
    let p = pet_at_level(50); // 3 级
    let food = p.food;
    let first = act(p, Action::Evolve { branch: Branch::Steady }, 1, "evo").unwrap();
    assert!(!first.replayed);
    assert_eq!(first.pet.growth.stage, Stage::Young);
    assert_eq!(first.pet.food, food - EVOLVE_FOOD_COST);
    assert_eq!(first.pet.growth.lineage, vec![Branch::Steady]);

    let again = act(first.pet.clone(), Action::Evolve { branch: Branch::Steady }, 1, "evo").unwrap();
    assert!(again.replayed);
    assert_eq!(again.pet.food, first.pet.food, "replay must not charge twice");
    assert_eq!(again.pet.growth.lineage.len(), 1);
}

#[test]
fn evolution_requires_the_owners_choice() {
    // 经验再高、条件再满足,也不会自动进化。
    let mut p = pet_at_level(1500);
    p.food = 99;
    for i in 0..50u64 {
        p.satiety = 100;
        p = do_act(p, Action::Feed, i, &format!("f{i}"));
    }
    assert_eq!(p.growth.stage, Stage::Baby);
    assert!(evolution_options(&p.growth, p.food).options.iter().any(|o| o.eligible));
}

#[test]
fn branch_must_match_the_current_stage() {
    let p = pet_at_level(1500);
    assert_eq!(code(act(p, Action::Evolve { branch: Branch::Sage }, 1, "e")), ErrorCode::NotEligible);
}

#[test]
fn trait_gated_branch_needs_the_trait() {
    let mut p = pet_at_level(50);
    p.growth.traits[CURIOUS] = 549;
    assert_eq!(code(act(p.clone(), Action::Evolve { branch: Branch::Curious }, 1, "a")), ErrorCode::NotEligible);
    p.growth.traits[CURIOUS] = 550;
    assert!(act(p, Action::Evolve { branch: Branch::Curious }, 1, "b").is_ok());
}

#[test]
fn full_path_to_the_acquired_rare_form_keeps_identity_and_birth_tier() {
    let birth = derive_birth(&BirthInput {
        world: "w".into(),
        request_id: "r".into(),
        server_seed: "11".repeat(32),
        client_seed: "22".repeat(32),
        born_at: 0,
    })
    .unwrap();
    let (id, rarity, species, genes) = (birth.id.clone(), birth.rarity, birth.species, birth.genes);
    let mut p = birth.pet;
    p.growth.exp = 1500;
    p.food = 30;
    p.growth.traits = [700, 700, 700];
    p.growth.base_traits = p.growth.base_traits.map(|b| b.min(500)); // 保证 +200 之内不用于本断言
    p = act(p, Action::Evolve { branch: Branch::Steady }, 1, "e1").unwrap().pet;
    let mut n = 0;
    for t in ["a", "b", "c"] {
        for _ in 0..22 {
            n += 1;
            p = grant(p, &reward(0, Some(t)), 2, &format!("g{n}")).unwrap().pet;
        }
    }
    let o = evolution_options(&p.growth, p.food);
    assert_eq!(o.stage, Stage::Young);
    assert!(o.options.iter().find(|x| x.branch == Branch::Radiant).unwrap().eligible, "{:?}", o.options);
    p = act(p, Action::Evolve { branch: Branch::Radiant }, 3, "e2").unwrap().pet;
    assert_eq!(p.growth.stage, Stage::Adult);
    assert_eq!(p.growth.acquired_rarity, 1);
    assert_eq!(p.growth.lineage, vec![Branch::Steady, Branch::Radiant]);
    // 出生身份、稀有度、物种与基因不随进化改变;稀有度本就不在存档里,而是由出生记录决定。
    assert_eq!(p.id, id);
    let again = derive_birth(&BirthInput {
        world: "w".into(),
        request_id: "r".into(),
        server_seed: "11".repeat(32),
        client_seed: "22".repeat(32),
        born_at: 0,
    })
    .unwrap();
    assert_eq!((again.rarity, again.species, again.genes), (rarity, species, genes));
    assert!(evolution_options(&p.growth, p.food).options.is_empty(), "adult has no further branches");
}

#[test]
fn radiant_lists_a_single_level_requirement() {
    let p = pet_at_level(300); // 6 级,少年阶段
    let mut g = p.growth.clone();
    g.stage = Stage::Young;
    let o = evolution_options(&g, p.food);
    let radiant = o.options.iter().find(|x| x.branch == Branch::Radiant).unwrap();
    let levels: Vec<_> = radiant.missing.iter().filter(|m| m.kind == MissingKind::Level).collect();
    assert_eq!(levels.len(), 1);
    assert_eq!(levels[0].need, 9);
}

#[test]
fn birth_base_traits_come_from_genes() {
    let g = Growth::base_from_genes(&[0, 0, 0, 0, 0, 0, 255, 100]);
    assert_eq!(g, [300, 555, 400]);
    for b in 0..=255u8 {
        let v = Growth::base_from_genes(&[0, 0, 0, 0, 0, b, b, b]);
        assert!(v.iter().all(|x| (300..700).contains(x)));
    }
}

#[test]
fn grant_validates_bounds_and_is_idempotent() {
    let p = Pet::newborn("p".into(), 0);
    for bad in [Reward { exp: 101, food: 0, medicine: 0, topic: None }, Reward { exp: 0, food: 11, medicine: 0, topic: None }, Reward { exp: 0, food: 0, medicine: 4, topic: None }, reward(0, Some("")), reward(0, Some(&"x".repeat(33)))] {
        assert_eq!(code(grant(p.clone(), &bad, 1, "g")), ErrorCode::InvalidReward);
    }
    let ok = grant(p, &Reward { exp: 10, food: 2, medicine: 1, topic: Some("rust".into()) }, 1, "g").unwrap();
    assert_eq!((ok.pet.growth.exp, ok.pet.food, ok.pet.medicine), (10, 7, 2));
    let replay = grant(ok.pet.clone(), &Reward { exp: 100, food: 10, medicine: 3, topic: None }, 1, "g").unwrap();
    assert!(replay.replayed);
    assert_eq!((replay.pet.growth.exp, replay.pet.food), (10, 7), "replay ignores the new payload and grants nothing");
}

#[test]
fn grant_caps_inventory_and_rejects_the_dead() {
    let mut p = Pet::newborn("p".into(), 0);
    p.food = 95;
    p = grant(p, &Reward { exp: 0, food: 10, medicine: 0, topic: None }, 1, "g1").unwrap().pet;
    assert_eq!(p.food, 99);
    p.neglect = 7200;
    assert_eq!(code(grant(p, &reward(1, None), 2, "g2")), ErrorCode::Dead);
}

#[test]
fn topics_are_bounded_and_evict_deterministically() {
    let mut p = Pet::newborn("p".into(), 0);
    for i in 0..12 {
        p = grant(p, &reward(0, Some(&format!("t{i}"))), 1, &format!("g{i}")).unwrap().pet;
    }
    assert_eq!(p.growth.topics.len(), 8);
    let names: Vec<_> = p.growth.topics.iter().map(|t| t.topic.as_str()).collect();
    assert_eq!(names, ["t4", "t5", "t6", "t7", "t8", "t9", "t10", "t11"]);
}
