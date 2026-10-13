use pet_core::{act, Action, Phase, Pet};

fn code(r: Result<pet_core::Outcome, pet_core::ActError>) -> pet_core::ErrorCode {
    r.err().expect("action must be rejected").code()
}

fn wait(p: Pet, now: u64, id: &str) -> Pet {
    act(p, Action::Wait, now, id).expect("alive pet accepts wait").pet
}

#[test]
fn coming_back_from_any_absence_never_kills() {
    // 任意饱食、任意失养起点、任意离开时长:被观察的时间之外不得越过死亡线。
    for satiety in [0u8, 1, 10, 50, 100] {
        for neglect in [0u64, 1000, 2879, 2880, 5000, 7199] {
            for gap in [31u64, 60, 360, 1440, 4320, 10_000, 100_000, 10_000_000] {
                let mut p = Pet::newborn("p".into(), 0);
                p.satiety = satiety;
                p.neglect = neglect;
                let phase_before = p.phase();
                let out = act(p, Action::Wait, gap, "back").expect("returning must not be rejected as dead");
                assert!(
                    out.phase != Phase::Dead || phase_before == Phase::Dead,
                    "satiety {satiety}, neglect {neglect}, gap {gap} died on return"
                );
            }
        }
    }
}

#[test]
fn frequent_settlement_does_not_freeze_decay() {
    // 每 10 刻度结算与一次结算 N 刻度,总衰减必须相同。
    let total = 24 * 60;
    let mut frequent = Pet::newborn("p".into(), 0);
    let mut t = 0;
    while t < total {
        t += 10;
        frequent = wait(frequent, t, &format!("f{t}"));
    }
    let once = wait(Pet::newborn("p".into(), 0), total, "once");
    assert_eq!((frequent.satiety, frequent.energy), (once.satiety, once.energy));
    assert!(frequent.satiety < 80, "decay must happen");
}

#[test]
fn sustained_observed_neglect_eventually_kills() {
    // 页面一直开着(持续被观察)而从不照料:最终死亡,且经历预警与生病。
    let mut p = Pet::newborn("p".into(), 0);
    let mut seen = vec![];
    let mut t = 0;
    loop {
        t += 10;
        match act(p.clone(), Action::Wait, t, &format!("w{t}")) {
            Ok(o) => {
                if seen.last() != Some(&o.phase) {
                    seen.push(o.phase);
                }
                p = o.pet;
            }
            Err(e) => {
                assert_eq!(e.code(), pet_core::ErrorCode::Dead);
                break;
            }
        }
        assert!(t < 1_000_000, "must die eventually");
    }
    assert_eq!(seen, vec![Phase::Healthy, Phase::Warned, Phase::Sick]);
}

#[test]
fn daily_feeding_stays_healthy() {
    let mut p = Pet::newborn("p".into(), 0);
    p.food = 999;
    for day in 1..=30u64 {
        let t = day * 24 * 60;
        p = wait(p, t, &format!("w{day}"));
        assert_eq!(p.phase(), Phase::Healthy, "day {day}");
        p = act(p, Action::Feed, t + 1, &format!("f{day}")).unwrap().pet;
    }
}

#[test]
fn medicine_is_the_way_back_from_sick() {
    let mut p = Pet::newborn("p".into(), 0);
    p = wait(p, 100 * 24 * 60, "away");
    assert_eq!(p.phase(), Phase::Sick);
    let fed = act(p.clone(), Action::Feed, 100 * 24 * 60 + 1, "feed").unwrap().pet;
    assert_eq!(fed.phase(), Phase::Sick, "food alone does not cure");
    let healed = act(fed, Action::Heal, 100 * 24 * 60 + 2, "heal").unwrap();
    assert_ne!(healed.phase, Phase::Sick);
}

#[test]
fn rejected_actions_report_a_distinct_code_and_produce_no_state() {
    use pet_core::ErrorCode::*;
    let base = Pet::newborn("p".into(), 0);

    let mut no_food = base.clone();
    no_food.food = 0;
    assert_eq!(code(act(no_food, Action::Feed, 1, "a")), NoFood);

    let mut no_medicine = wait(base.clone(), 100 * 24 * 60, "away");
    no_medicine.medicine = 0;
    let t = no_medicine.last_tick;
    assert_eq!(code(act(no_medicine, Action::Heal, t, "b")), NoMedicine);

    assert_eq!(code(act(base.clone(), Action::Heal, 1, "c")), NotSick);

    let mut tired = base.clone();
    tired.energy = 19;
    assert_eq!(code(act(tired, Action::Play, 0, "d")), TooTired);

    assert!(act(base.clone(), Action::Wait, 0, "e").is_ok());
    let mut later = base;
    later.last_tick = 100;
    assert_eq!(code(act(later, Action::Wait, 50, "f")), TimeBackwards);
}

#[test]
fn dead_pet_rejects_every_action() {
    let mut p = Pet::newborn("p".into(), 0);
    p.neglect = 7200;
    for (i, a) in [Action::Feed, Action::Rest, Action::Play, Action::Heal, Action::Wait].into_iter().enumerate() {
        assert_eq!(code(act(p.clone(), a, 0, &format!("d{i}"))), pet_core::ErrorCode::Dead);
    }
}
