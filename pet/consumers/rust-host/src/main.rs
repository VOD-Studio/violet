//! 一个“宿主”终端工具如何嵌入宠物:只在宿主划定的矩形里绘制,不接管终端。
//! 规则核心给出出生与状态,pet-term 合成字符帧,宿主自己决定如何输出。
use std::fmt::Write as _;

struct Region {
    row: u16,
    col: u16,
    width: u16,
    height: u16,
}

/// 把一帧写进宿主的输出缓冲:保存光标、绝对定位逐行绘制、恢复光标。
fn draw(out: &mut String, region: &Region, frame: &pet_term::Frame) {
    out.push_str("\x1b7");
    for (y, row) in frame.rows.iter().enumerate() {
        write!(out, "\x1b[{};{}H{}", region.row + y as u16, region.col, row).unwrap();
    }
    out.push_str("\x1b8");
}

fn clear(out: &mut String, region: &Region) {
    out.push_str("\x1b7");
    for y in 0..region.height {
        write!(out, "\x1b[{};{}H{}", region.row + y, region.col, " ".repeat(region.width as usize)).unwrap();
    }
    out.push_str("\x1b8");
}

fn frame_for(species: u8, genes: [u8; 8], t: u64, region: &Region) -> pet_term::Frame {
    let input: pet_term::FrameInput = serde_json::from_value(serde_json::json!({
        "species": species, "genes": genes, "pose": "idle", "charset": "ascii",
        "w": region.width, "h": region.height, "t": t.to_string(),
    }))
    .unwrap();
    pet_term::render(&input)
}

fn main() {
    // 出生:通过核心的统一 JSON 入口,和 Web、Node 完全一致。
    let birth: serde_json::Value = serde_json::from_str(&pet_core::execute(
        &serde_json::json!({"op":"birth","world":"w1","request_id":"r1","server_seed":"aa".repeat(32),"client_seed":"bb".repeat(32),"born_at":"0"}).to_string(),
    ))
    .unwrap();
    let species = birth["value"]["species"].as_u64().unwrap() as u8;
    let genes: Vec<u8> = birth["value"]["genes"].as_array().unwrap().iter().map(|g| g.as_u64().unwrap() as u8).collect();
    let genes: [u8; 8] = genes.try_into().unwrap();

    let region = Region { row: 1, col: 30, width: 11, height: 3 };
    let mut out = String::new();
    for t in 0..40 {
        draw(&mut out, &region, &frame_for(species, genes, t, &region));
    }
    clear(&mut out, &region);
    print!("{out}");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn session() -> (String, Region) {
        let region = Region { row: 2, col: 30, width: 11, height: 3 };
        let mut out = String::new();
        for t in 0..60 {
            draw(&mut out, &region, &frame_for(1, [37, 0, 0, 0, 0, 0, 0, 0], t, &region));
        }
        clear(&mut out, &region);
        (out, region)
    }

    #[test]
    fn host_owns_the_terminal_the_pet_only_borrows_a_rectangle() {
        let (out, region) = session();
        for forbidden in ["\x1b[?1049", "\x1b[?25l", "\x1b[?25h", "\x1b[2J", "\x1b[r", "\x1b[?1000"] {
            assert!(!out.contains(forbidden), "pet output must not contain {forbidden:?}");
        }
        // 每一次定位都落在宿主划定的行内。
        let rows: Vec<u16> = out.split("\x1b[").skip(1).filter_map(|s| s.split_once(';').and_then(|(r, _)| r.parse().ok())).collect();
        assert!(!rows.is_empty());
        assert!(rows.iter().all(|r| (region.row..region.row + region.height).contains(r)), "rows used: {rows:?}");
        // 每次绘制都成对保存与恢复光标。
        assert_eq!(out.matches("\x1b7").count(), out.matches("\x1b8").count());
    }

    #[test]
    fn pet_moves_between_frames_and_stays_inside_the_region() {
        let region = Region { row: 1, col: 1, width: 11, height: 3 };
        let cols: std::collections::BTreeSet<usize> = (0..60)
            .filter_map(|t| frame_for(1, [37, 0, 0, 0, 0, 0, 0, 0], t, &region).rows.iter().find_map(|r| r.find('(')))
            .collect();
        assert!(cols.len() > 1, "the pet should move");
        assert!(cols.iter().all(|c| c + 6 <= region.width as usize), "cols {cols:?}");
    }

    #[test]
    fn dispose_clears_exactly_the_region() {
        let (out, region) = session();
        let tail = out.rsplit_once("\x1b7").unwrap().1;
        assert_eq!(tail.matches(&" ".repeat(region.width as usize)).count(), region.height as usize);
    }
}
