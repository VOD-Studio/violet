//! 终端画风预览:打印全部物种在各姿态下的帧,用于素材评审(无颜色,纯字符)。
use pet_term::*;

fn frame(species: u8, pose: Pose, t: u64) -> Vec<String> {
    let input: FrameInput = serde_json::from_value(serde_json::json!({
        "species": species, "genes": [37, 0, 0, 0, 0, 0, 0, 0], "pose": pose_name(pose), "charset": "ascii", "w": 9, "h": 3, "t": t.to_string(),
    }))
    .unwrap();
    render(&input).rows
}

fn pose_name(p: Pose) -> &'static str {
    match p {
        Pose::Idle => "idle",
        Pose::Observe => "observe",
        Pose::Eat => "eat",
        Pose::Play => "play",
        Pose::Sleep => "sleep",
        Pose::Startled => "startled",
        Pose::Sick => "sick",
        Pose::Evolve => "evolve",
        Pose::End => "end",
    }
}

fn main() {
    let poses = [Pose::Idle, Pose::Observe, Pose::Eat, Pose::Play, Pose::Sleep, Pose::Startled, Pose::Sick, Pose::Evolve, Pose::End];
    for s in 0..SPECIES_COUNT {
        println!("== 物种 {s}（{:?}）", body_of(s));
        let cols: Vec<Vec<String>> = poses.iter().map(|p| frame(s, *p, 2)).collect();
        println!("{}", poses.iter().map(|p| format!("{:<9}", pose_name(*p))).collect::<Vec<_>>().join(" "));
        for row in 0..3 {
            println!("{}", cols.iter().map(|c| c[row].clone()).collect::<Vec<_>>().join(" "));
        }
        println!();
    }
}
