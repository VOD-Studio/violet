#![no_std]
#![forbid(unsafe_code)]

extern crate alloc;

use alloc::string::String;
use alloc::vec::Vec;
use serde::{Deserialize, Serialize};

const SPRITE_W: u16 = 7;
const SPRITE_H: u16 = 3;

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Pose {
    Idle,
    Sick,
    Sleep,
}

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Charset {
    Ascii,
    Unicode,
}

/// 帧合成输入:投影字段 + 呈现时钟。呈现时钟只影响动作相位,不影响任何养成结果。
#[derive(Deserialize)]
#[allow(missing_docs)]
pub struct FrameInput {
    pub species: u8,
    pub genes: [u8; 8],
    pub pose: Pose,
    pub charset: Charset,
    pub w: u16,
    pub h: u16,
    #[serde(with = "u64_string")]
    pub t: u64,
}

#[derive(Serialize)]
pub struct Frame {
    pub w: u16,
    pub h: u16,
    pub rows: Vec<String>,
    /// 与 rows 逐字符对应的 256 色索引;0 表示不着色。
    pub colors: Vec<Vec<u8>>,
}

mod u64_string {
    use alloc::string::String;
    use serde::{de::Error, Deserialize, Deserializer};

    pub fn deserialize<'de, D: Deserializer<'de>>(d: D) -> Result<u64, D::Error> {
        String::deserialize(d)?.parse().map_err(D::Error::custom)
    }
}

fn sprite(i: &FrameInput, blink: bool, step: u64) -> [String; 3] {
    let ears = match i.species % 4 {
        0 => " /\\_/\\ ",
        1 => " (\\_/) ",
        2 => " /\\ /\\ ",
        _ => " ,---, ",
    };
    let unicode = matches!(i.charset, Charset::Unicode);
    let eye = match (i.pose, blink) {
        (Pose::Sick, _) => 'x',
        (Pose::Sleep, _) | (_, true) => '-',
        _ if unicode => '\u{25cf}',
        _ => 'o',
    };
    let mut r0 = String::from(ears);
    if matches!(i.pose, Pose::Sleep) {
        r0.pop();
        r0.push('z');
    }
    let mut r1 = String::from("( ");
    r1.push(eye);
    r1.push('.');
    r1.push(eye);
    r1.push_str(" )");
    let r2 = match ((i.species / 4).is_multiple_of(2), step % 2) {
        (true, 0) => " /| |\\ ",
        (true, _) => " \\| |/ ",
        (false, 0) => " <___> ",
        (false, _) => " >___< ",
    };
    [r0, r1, String::from(r2)]
}

/// 合成一帧字符单元网格。尺寸小于精灵时裁剪,不 panic。
pub fn render(i: &FrameInput) -> Frame {
    let (w, h) = (i.w.max(1), i.h.max(1));
    let mut cells: Vec<Vec<(char, u8)>> = (0..h).map(|_| (0..w).map(|_| (' ', 0)).collect()).collect();

    let walking = matches!(i.pose, Pose::Idle);
    let span = w.saturating_sub(SPRITE_W) as u64;
    let x0 = if walking && span > 0 {
        let period = span * 2;
        let pos = (i.t / 2) % period;
        if pos <= span { pos } else { period - pos }
    } else {
        span / 2
    };
    let step = if walking { i.t / 2 } else { 0 };
    let blink = i.t % 40 >= 38;
    let bob = u16::from(walking && step % 2 == 1 && h > SPRITE_H);
    let y0 = h.saturating_sub(SPRITE_H + bob);
    let color = match i.pose {
        Pose::Sick => 244,
        _ => 16 + (i.genes[0] % 216),
    };

    for (dy, line) in sprite(i, blink, step).iter().enumerate() {
        let y = y0 as usize + dy;
        if y >= h as usize {
            continue;
        }
        for (dx, ch) in line.chars().enumerate() {
            let x = x0 as usize + dx;
            if x < w as usize && ch != ' ' {
                cells[y][x] = (ch, color);
            }
        }
    }
    Frame {
        w,
        h,
        rows: cells.iter().map(|r| r.iter().map(|c| c.0).collect()).collect(),
        colors: cells.iter().map(|r| r.iter().map(|c| c.1).collect()).collect(),
    }
}
