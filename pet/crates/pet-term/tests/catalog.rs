//! 素材清单校验:声明必须与实现一致,结构与动作覆盖可检查,而不是靠数量或一张静态图。
use pet_term::*;
use serde_json::Value;
use std::collections::BTreeSet;

fn manifest() -> Value {
    serde_json::from_str(include_str!("../../../catalog/species.json")).unwrap()
}

fn rows(species: u8, pose: &str, t: u64, w: u16) -> Vec<String> {
    let input: FrameInput = serde_json::from_value(serde_json::json!({
        "species": species, "genes": [37, 0, 0, 0, 0, 0, 0, 0], "pose": pose, "charset": "ascii", "w": w, "h": 4, "t": t.to_string(),
    }))
    .unwrap();
    render(&input).rows
}

/// 一段时间内的完整帧序列,用来比较“动作”而不是单帧。
fn sequence(species: u8, pose: &str) -> Vec<Vec<String>> {
    (0..40).map(|t| rows(species, pose, t, 14)).collect()
}

const POSES: [&str; 9] = ["idle", "observe", "eat", "play", "sleep", "startled", "sick", "evolve", "end"];

#[test]
fn ids_cover_every_species_exactly_once() {
    let m = manifest();
    let ids: Vec<u64> = m["species"].as_array().unwrap().iter().map(|s| s["id"].as_u64().unwrap()).collect();
    assert_eq!(ids, (0..SPECIES_COUNT as u64).collect::<Vec<_>>());
    let keys: BTreeSet<_> = m["species"].as_array().unwrap().iter().map(|s| s["key"].as_str().unwrap()).collect();
    assert_eq!(keys.len(), SPECIES_COUNT as usize, "keys must be unique");
}

#[test]
fn the_four_creature_directions_are_all_present() {
    let m = manifest();
    let mut by: std::collections::BTreeMap<&str, usize> = Default::default();
    for s in m["species"].as_array().unwrap() {
        *by.entry(s["category"].as_str().unwrap()).or_default() += 1;
    }
    assert_eq!(by.keys().copied().collect::<Vec<_>>(), ["fantasy", "mechanical", "nature", "real_pet"]);
    assert!(by.values().all(|n| *n >= 2), "{by:?}");
}

#[test]
fn declared_body_matches_the_renderer() {
    for s in manifest()["species"].as_array().unwrap() {
        let want = match s["body"].as_str().unwrap() {
            "walker" => Body::Walker,
            "floater" => Body::Floater,
            "rooted" => Body::Rooted,
            other => panic!("unknown body {other}"),
        };
        assert_eq!(body_of(s["id"].as_u64().unwrap() as u8), want, "{}", s["key"]);
    }
}

#[test]
fn ready_styles_declare_full_action_coverage_and_planned_ones_declare_none() {
    let m = manifest();
    let required: Vec<&str> = m["required_actions"].as_array().unwrap().iter().map(|a| a.as_str().unwrap()).collect();
    assert_eq!(required.len(), 11);
    for s in m["species"].as_array().unwrap() {
        for (style, status) in s["styles"].as_object().unwrap() {
            let declared: Vec<&str> = s["actions"].get(style).and_then(|a| a.as_array()).map(|a| a.iter().map(|x| x.as_str().unwrap()).collect()).unwrap_or_default();
            match status.as_str().unwrap() {
                "ready" => assert_eq!(declared, required, "{} {style} must cover every required action", s["key"]),
                "planned" => assert!(declared.is_empty(), "{} {style} is planned but declares actions", s["key"]),
                other => panic!("unknown status {other}"),
            }
        }
        // 终端与像素画风有实现；精细画风必须保持 planned，直到真有实现。
        assert_eq!(s["styles"]["terminal"], "ready");
        assert_eq!(s["styles"]["pixel"], "ready");
        assert_eq!(s["styles"]["fine"], "planned");
    }
}

#[test]
fn every_declared_pose_really_renders_for_every_species() {
    for sp in 0..SPECIES_COUNT {
        for pose in POSES {
            let r = rows(sp, pose, 3, 12);
            assert_eq!(r.len(), 4);
            assert!(r.iter().all(|row| row.chars().count() == 12), "{sp} {pose}");
            assert!(r.iter().any(|row| row.trim() != ""), "{sp} {pose} rendered nothing");
        }
    }
}

#[test]
fn license_and_source_are_declared() {
    let allowed = ["CC-BY-4.0", "CC0-1.0", "MIT"];
    for s in manifest()["species"].as_array().unwrap() {
        assert!(allowed.contains(&s["license"].as_str().unwrap()), "{}", s["key"]);
        assert!(!s["source"].as_str().unwrap().is_empty());
        assert!(!s["author"].as_str().unwrap().is_empty());
        assert!(!s["identity_cues"].as_array().unwrap().is_empty());
    }
}

#[test]
fn species_are_distinguishable_without_color() {
    // 仅凭字符（不看颜色）就能区分任意两个物种：待机帧序列互不相同。
    let seqs: Vec<_> = (0..SPECIES_COUNT).map(|s| sequence(s, "idle")).collect();
    for a in 0..seqs.len() {
        for b in a + 1..seqs.len() {
            assert!(seqs[a] != seqs[b], "species {a} and {b} look identical");
        }
    }
    // 静止的单帧也应不同：比较第一行与第二行的头部/脸部（去掉位移影响）。
    let shapes: BTreeSet<_> = (0..SPECIES_COUNT).map(|s| rows(s, "observe", 0, 7)[1..4].to_vec()).collect();
    assert_eq!(shapes.len(), SPECIES_COUNT as usize, "static silhouettes must all differ");
}

#[test]
fn poses_are_distinguishable_within_a_species() {
    for sp in 0..SPECIES_COUNT {
        let seqs: Vec<_> = POSES.iter().map(|p| sequence(sp, p)).collect();
        for a in 0..seqs.len() {
            for b in a + 1..seqs.len() {
                assert!(seqs[a] != seqs[b], "species {sp}: {} and {} are the same action", POSES[a], POSES[b]);
            }
        }
    }
}

#[test]
fn motion_follows_the_body_structure() {
    let first_col = |sp: u8, t: u64| -> Option<usize> { rows(sp, "idle", t, 20).iter().find_map(|r| r.find(|c| c != ' ')) };
    for sp in 0..SPECIES_COUNT {
        let cols: BTreeSet<_> = (0..80).filter_map(|t| first_col(sp, t)).collect();
        match body_of(sp) {
            Body::Walker | Body::Floater => assert!(cols.len() > 3, "species {sp} should travel horizontally: {cols:?}"),
            Body::Rooted => assert_eq!(cols.len(), 1, "a rooted species must not travel: {cols:?}"),
        }
        if body_of(sp) == Body::Rooted {
            let frames: BTreeSet<_> = (0..80).map(|t| rows(sp, "idle", t, 20)).collect();
            assert!(frames.len() > 1, "a rooted species should still sway");
        }
    }
    // 悬浮者没有脚：下半身不出现行走用的腿部字符。
    for sp in (0..SPECIES_COUNT).filter(|s| body_of(*s) == Body::Floater) {
        for t in 0..40 {
            let r = rows(sp, "idle", t, 14);
            let bottom = r.iter().rev().find(|row| row.trim() != "").unwrap();
            assert!(!bottom.contains('|') && !bottom.contains('_'), "floater {sp} has legs: {bottom:?}");
        }
    }
}

#[test]
fn tiny_regions_never_panic_for_any_species_or_pose() {
    for sp in 0..SPECIES_COUNT {
        for pose in POSES {
            for (w, h) in [(1, 1), (3, 2), (7, 3)] {
                let input: FrameInput = serde_json::from_value(serde_json::json!({"species": sp, "genes": [1,2,3,4,5,6,7,8], "pose": pose, "charset": "unicode", "w": w, "h": h, "t": "7"})).unwrap();
                let f = render(&input);
                assert_eq!((f.rows.len(), f.rows[0].chars().count()), (h as usize, w as usize));
            }
        }
    }
}
