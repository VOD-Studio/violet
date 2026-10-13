//! 快进体验记录:用规则核心跑典型场景,输出各阶段的真实耗时(1 逻辑刻度 = 1 分钟)。
use pet_core::{act, Action, Phase, Pet};

fn fmt(minutes: u64) -> String {
    format!("{}h{:02}m", minutes / 60, minutes % 60)
}

fn step(p: Pet, a: Action, now: u64, id: &str) -> Result<Pet, String> {
    act(p, a, now, id).map(|o| o.pet).map_err(|e| e.message().to_string())
}

/// 持续在线(每 `every` 分钟结算一次),从不照料。
fn present_never_fed(every: u64) {
    let mut p = Pet::newborn("p".into(), 0);
    let mut last = Phase::Healthy;
    let mut t = 0;
    println!("场景 A:一直在线(每 {every} 分钟结算),从不喂食");
    loop {
        t += every;
        match step(p.clone(), Action::Wait, t, &format!("a{t}")) {
            Ok(n) => p = n,
            Err(e) => {
                println!("  {} 拒绝: {e}", fmt(t));
                break;
            }
        }
        if p.phase() != last {
            println!("  {} 进入 {:?}(饱食 {})", fmt(t), p.phase(), p.satiety);
            last = p.phase();
        }
        if last == Phase::Dead || t > 12000 {
            break;
        }
    }
}

/// 离开 `away` 分钟后回来。
fn away(away: u64, fed_first: bool) {
    let mut p = Pet::newborn("p".into(), 0);
    if fed_first {
        p = step(p, Action::Feed, 1, "f").unwrap();
    }
    match step(p, Action::Wait, 1 + away, "back") {
        Ok(n) => println!("  离开 {:>7}:回来时 {:?}(饱食 {},失养 {} 分钟)", fmt(away), n.phase(), n.satiety, n.neglect),
        Err(e) => println!("  离开 {:>7}:回来时被拒绝: {e}", fmt(away)),
    }
}

fn main() {
    present_never_fed(10);
    println!("\n场景 B:离开后回来(出生后喂过一次)");
    for m in [60, 6 * 60, 9 * 60, 12 * 60, 13 * 60, 24 * 60, 7 * 24 * 60, 90 * 24 * 60] {
        away(m, true);
    }
    for (label, days) in [("D", 1u64), ("E", 2), ("F", 3)] {
        println!("\n场景 {label}:每 {days} 天来一次、每次只喂一次(连续 30 天)");
        let mut p = Pet::newborn("p".into(), 0);
        p.food = 999;
        let (mut worst, mut sick_visits) = (Phase::Healthy, 0);
        let visits = 30 / days;
        for v in 1..=visits {
            let t = v * days * 24 * 60;
            p = step(p, Action::Wait, t, &format!("w{v}")).unwrap();
            if p.phase() as u8 > worst as u8 {
                worst = p.phase();
            }
            if p.phase() == Phase::Sick {
                sick_visits += 1;
            }
            p = step(p, Action::Feed, t + 1, &format!("f{v}")).unwrap();
        }
        println!("  最差阶段 {:?},到访时处于生病 {} / {} 次,最终饱食 {}", worst, sick_visits, visits, p.satiety);
    }
    println!("\n场景 C:在饱食较低时离开,检验是否会在「回来」的瞬间死亡");
    let mut worst = (0, 0);
    for satiety_target in [60u64, 30, 10, 0] {
        for gap in (30..=24 * 60).step_by(30) {
            let mut p = Pet::newborn("p".into(), 0);
            p.satiety = satiety_target as u8;
            if let Ok(n) = step(p, Action::Wait, gap as u64, "x") {
                if n.phase() == Phase::Dead {
                    worst = (satiety_target, gap);
                    println!("  饱食 {satiety_target}:离开 {} 回来即死亡", fmt(gap as u64));
                    break;
                }
            } else {
                worst = (satiety_target, gap);
                println!("  饱食 {satiety_target}:离开 {} 回来被拒绝(已死亡)", fmt(gap as u64));
                break;
            }
        }
    }
    if worst == (0, 0) {
        println!("  未发现「离开后回来即死亡」的组合");
    }
}
