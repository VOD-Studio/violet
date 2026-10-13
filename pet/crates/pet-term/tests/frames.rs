use pet_term::*;

fn input(w: u16, h: u16, t: u64, pose: Pose) -> FrameInput {
    FrameInput { species: 0, genes: [10; 8], pose, charset: Charset::Ascii, w, h, t }
}

#[test]
fn golden_frame() {
    let f = render(&input(12, 4, 0, Pose::Idle));
    assert_eq!(f.rows, vec!["            ", " /\\_/\\      ", "( o.o )     ", " /| |\\      "]);
}

#[test]
fn any_size_is_safe_and_exact() {
    for (w, h) in [(1, 1), (3, 2), (7, 3), (40, 10), (200, 60)] {
        for t in [0, 1, 39, 1_000_003] {
            let f = render(&input(w, h, t, Pose::Idle));
            assert_eq!(f.rows.len(), h as usize);
            assert!(f.rows.iter().all(|r| r.chars().count() == w as usize));
        }
    }
}

#[test]
fn poses_are_distinguishable_without_color() {
    let rows = |p| render(&input(20, 5, 0, p)).rows.join("\n");
    assert_ne!(rows(Pose::Idle), rows(Pose::Sick));
    assert_ne!(rows(Pose::Idle), rows(Pose::Sleep));
    assert_ne!(rows(Pose::Sick), rows(Pose::Sleep));
}

#[test]
fn walking_moves_and_stays_in_bounds() {
    let xs: Vec<usize> = (0..60).map(|t| render(&input(20, 4, t, Pose::Idle)).rows.iter().find_map(|r| r.find('(')).unwrap()).collect();
    assert!(xs.iter().all(|x| *x + 7 <= 20));
    assert!(xs.iter().min() != xs.iter().max());
}
