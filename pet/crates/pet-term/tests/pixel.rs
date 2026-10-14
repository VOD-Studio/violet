//! 像素画风校验:与终端画风同样的结构检查,「不看颜色」指不看调色板色相,只比较像素的键位图。
use pet_term::*;
use std::collections::BTreeSet;

const POSES: [&str; 9] = ["idle", "observe", "eat", "play", "sleep", "startled", "sick", "evolve", "end"];

fn px(species: u8, pose: &str, stage: u8, t: u64, w: u16, h: u16) -> Pixels {
    let input: PixelInput = serde_json::from_value(serde_json::json!({
        "species": species, "genes": [37, 3, 0, 0, 0, 0, 0, 0], "pose": pose, "stage": stage, "w": w, "h": h, "t": t.to_string(),
    }))
    .unwrap();
    render_pixels(&input)
}

fn keys(species: u8, pose: &str, stage: u8, t: u64, w: u16) -> Vec<String> {
    px(species, pose, stage, t, w, 18).rows
}

fn sequence(species: u8, pose: &str) -> Vec<Vec<String>> {
    (0..40).map(|t| keys(species, pose, 0, t, 14)).collect()
}

#[test]
fn every_species_and_pose_renders_inside_the_requested_grid_with_known_keys() {
    for sp in 0..SPECIES_COUNT {
        for pose in POSES {
            for stage in 0..3 {
                let p = px(sp, pose, stage, 3, 20, 18);
                assert_eq!((p.rows.len(), p.w, p.h), (18, 20, 18));
                assert!(p.rows.iter().all(|r| r.chars().count() == 20), "{sp} {pose}");
                assert!(p.rows.iter().any(|r| r.chars().any(|c| c != '.')), "{sp} {pose} rendered nothing");
                for c in p.rows.iter().flat_map(|r| r.chars()).filter(|c| *c != '.') {
                    assert!(p.palette.contains_key(&c.to_string()), "{sp} {pose}: key {c:?} has no colour");
                }
                for (k, v) in &p.palette {
                    assert_eq!(k.chars().count(), 1);
                    assert!(v.len() == 7 && v.starts_with('#') && v[1..].chars().all(|c| c.is_ascii_hexdigit()), "bad colour {v}");
                }
            }
        }
    }
}

#[test]
fn placeholders_never_leak_into_the_output() {
    for sp in 0..SPECIES_COUNT {
        for pose in POSES {
            let p = px(sp, pose, 2, 5, 20, 18);
            assert!(p.rows.iter().all(|r| !r.contains('E') && !r.contains('M')), "{sp} {pose} leaked a template placeholder");
        }
    }
}

#[test]
fn species_are_distinguishable_by_pixel_layout_alone() {
    let seqs: Vec<_> = (0..SPECIES_COUNT).map(|s| sequence(s, "idle")).collect();
    for a in 0..seqs.len() {
        for b in a + 1..seqs.len() {
            assert!(seqs[a] != seqs[b], "species {a} and {b} look identical");
        }
    }
    // 静止的轮廓(是否有像素)也要全部不同,不能只靠内部纹理区分。
    let outlines: BTreeSet<_> = (0..SPECIES_COUNT)
        .map(|s| keys(s, "observe", 0, 0, 14).iter().map(|r| r.chars().map(|c| c != '.').collect::<Vec<_>>()).collect::<Vec<_>>())
        .collect();
    assert_eq!(outlines.len(), SPECIES_COUNT as usize, "static silhouettes must all differ");
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
fn blinking_changes_pixels_without_changing_the_pose() {
    for sp in 0..SPECIES_COUNT {
        assert_ne!(keys(sp, "observe", 0, 0, 14), keys(sp, "idle", 0, 39, 14), "species {sp}");
        assert_ne!(keys(sp, "idle", 0, 0, 14), keys(sp, "idle", 0, 39, 14), "species {sp} never blinks");
    }
}

#[test]
fn motion_follows_the_body_structure() {
    let first_col = |sp: u8, t: u64| -> Option<usize> { keys(sp, "idle", 0, t, 40).iter().find_map(|r| r.find(|c| c != '.')) };
    for sp in 0..SPECIES_COUNT {
        let cols: BTreeSet<_> = (0..120).filter_map(|t| first_col(sp, t)).collect();
        match body_of(sp) {
            Body::Walker | Body::Floater => assert!(cols.len() > 3, "species {sp} should travel horizontally: {cols:?}"),
            Body::Rooted => assert_eq!(cols.len(), 1, "a rooted species must not travel: {cols:?}"),
        }
        if body_of(sp) == Body::Rooted {
            let frames: BTreeSet<_> = (0..80).map(|t| keys(sp, "idle", 0, t, 40)).collect();
            assert!(frames.len() > 1, "a rooted species should still sway");
        }
    }
    // 悬浮者没有脚:任何待机帧的最底部像素都不能是行走用的腿部(身体色或外框色)。
    for sp in (0..SPECIES_COUNT).filter(|s| body_of(*s) == Body::Floater && *s != 1) {
        for t in 0..40 {
            let p = px(sp, "idle", 0, t, 14, 18);
            let bottom = p.rows.iter().rev().find(|r| r.chars().any(|c| c != '.')).unwrap();
            assert!(bottom.chars().all(|c| matches!(c, '.' | 'a' | 'o')), "floater {sp} has legs: {bottom:?}");
        }
    }
}

#[test]
fn growth_stage_changes_the_picture_and_adult_wears_the_crown() {
    for sp in 0..SPECIES_COUNT {
        let s: Vec<_> = (0..3).map(|st| keys(sp, "idle", st, 0, 14)).collect();
        assert!(s[0] != s[1] && s[1] != s[2] && s[0] != s[2], "species {sp}: stages look the same");
        assert!(s[2].iter().any(|r| r.contains('y')), "species {sp}: adult has no crown");
        assert!(s[0].iter().all(|r| !r.contains('y')), "species {sp}: a baby must not wear a crown");
    }
}

#[test]
fn stage_overlays_touch_the_body_and_never_float() {
    // 点缀物 = 与幼体相比多出来的像素;它们必须经 8 邻接一路连到幼体的像素上。
    for sp in 0..SPECIES_COUNT {
        let base = keys(sp, "observe", 0, 0, 14);
        for stage in [1u8, 2] {
            let grown = keys(sp, "observe", stage, 0, 14);
            let cell = |rows: &Vec<String>, y: i32, x: i32| -> bool {
                y >= 0 && x >= 0 && rows.get(y as usize).and_then(|r| r.chars().nth(x as usize)).is_some_and(|c| c != '.')
            };
            let mut extra = Vec::new();
            for y in 0..grown.len() as i32 {
                for x in 0..14 {
                    if cell(&grown, y, x) && !cell(&base, y, x) {
                        extra.push((y, x));
                    }
                }
            }
            assert!(!extra.is_empty(), "species {sp} stage {stage} adds nothing");
            let mut attached: BTreeSet<(i32, i32)> = BTreeSet::new();
            loop {
                let before = attached.len();
                for &(y, x) in &extra {
                    let touches = (-1..=1).any(|dy| (-1..=1).any(|dx| (dy, dx) != (0, 0) && (cell(&base, y + dy, x + dx) || attached.contains(&(y + dy, x + dx)))));
                    if touches {
                        attached.insert((y, x));
                    }
                }
                if attached.len() == before {
                    break;
                }
            }
            assert_eq!(attached.len(), extra.len(), "species {sp} stage {stage}: floating overlay pixels");
        }
    }
}

#[test]
fn sick_and_end_change_the_palette_but_each_pose_differs_by_layout_too() {
    for sp in 0..SPECIES_COUNT {
        let idle = px(sp, "idle", 1, 0, 14, 18);
        let sick = px(sp, "sick", 1, 0, 14, 18);
        let end = px(sp, "end", 1, 0, 14, 18);
        assert_ne!(idle.palette["b"], sick.palette["b"], "{sp}");
        assert_ne!(sick.palette["b"], end.palette["b"], "{sp}");
        assert_ne!(idle.rows, sick.rows, "sick must be recognisable without colour");
        assert_ne!(sick.rows, end.rows, "end must be recognisable without colour");
    }
}

#[test]
fn genes_change_the_colours_but_not_the_layout() {
    let a: PixelInput = serde_json::from_value(serde_json::json!({"species":0,"genes":[10,0,0,0,0,0,0,0],"pose":"idle","stage":0,"w":14,"h":18,"t":"0"})).unwrap();
    let b: PixelInput = serde_json::from_value(serde_json::json!({"species":0,"genes":[200,0,0,0,0,0,0,0],"pose":"idle","stage":0,"w":14,"h":18,"t":"0"})).unwrap();
    let (pa, pb) = (render_pixels(&a), render_pixels(&b));
    assert_eq!(pa.rows, pb.rows);
    assert_ne!(pa.palette["b"], pb.palette["b"]);
}

#[test]
fn identical_input_gives_identical_output() {
    for sp in 0..SPECIES_COUNT {
        let (a, b) = (px(sp, "evolve", 2, 9, 30, 16), px(sp, "evolve", 2, 9, 30, 16));
        assert_eq!((a.rows, a.palette), (b.rows, b.palette));
    }
}

#[test]
fn tiny_canvases_never_panic() {
    for sp in 0..SPECIES_COUNT {
        for pose in POSES {
            for (w, h) in [(1, 1), (3, 2), (14, 5), (14, 12)] {
                let p = px(sp, pose, 2, 7, w, h);
                assert_eq!((p.rows.len(), p.rows[0].chars().count()), (h as usize, w as usize));
            }
        }
    }
}
