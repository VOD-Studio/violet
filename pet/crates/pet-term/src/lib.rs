#![no_std]
#![forbid(unsafe_code)]

extern crate alloc;

use alloc::string::String;
use alloc::vec::Vec;
use serde::{Deserialize, Serialize};

const SPRITE_W: u16 = 7;
const SPRITE_H: u16 = 3;

/// 姿态。眨眼由呈现时钟自动产生,不单独设姿态;移动随身体结构变化(见 `Body`)。
#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize)]
#[cfg_attr(feature = "schema", derive(schemars::JsonSchema))]
#[serde(rename_all = "snake_case")]
pub enum Pose {
    /// 待机并随结构移动。
    Idle,
    /// 注视前方并停下。
    Observe,
    Eat,
    Play,
    Sleep,
    Startled,
    Sick,
    Evolve,
    /// 生命终结(纪念形象):灰色、静止。
    End,
}

/// 身体结构决定移动方式,而不是给所有物种套同一套走路动画。
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Body {
    /// 四足与双足:左右行走并上下起伏。
    Walker,
    /// 悬浮:左右漂移,没有脚,起伏更明显。
    Floater,
    /// 扎根:原地摇摆,不位移。
    Rooted,
}

pub const SPECIES_COUNT: u8 = 8;

/// 物种的身体结构。必须与 `catalog/species.json` 一致,由测试保证。
pub const fn body_of(species: u8) -> Body {
    match species % SPECIES_COUNT {
        1 | 5 => Body::Floater,
        6 => Body::Rooted,
        _ => Body::Walker,
    }
}

#[derive(Clone, Copy, Deserialize)]
#[cfg_attr(feature = "schema", derive(schemars::JsonSchema))]
#[serde(rename_all = "snake_case")]
pub enum Charset {
    Ascii,
    Unicode,
}

/// 帧合成输入:投影字段 + 呈现时钟。呈现时钟只影响动作相位,不影响任何养成结果。
#[derive(Deserialize)]
#[cfg_attr(feature = "schema", derive(schemars::JsonSchema))]
#[allow(missing_docs)]
pub struct FrameInput {
    pub species: u8,
    pub genes: [u8; 8],
    pub pose: Pose,
    pub charset: Charset,
    pub w: u16,
    pub h: u16,
    #[serde(with = "u64_string")]
    #[cfg_attr(feature = "schema", schemars(with = "String"))]
    pub t: u64,
}

#[derive(Serialize)]
#[cfg_attr(feature = "schema", derive(schemars::JsonSchema))]
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

/// 每个物种的身体模板:头部、脸(`E` 为眼睛占位)、两帧下半身。宽 7、高 3。
/// 下半身两帧交替表示走动、漂移或摇摆。
struct Design {
    head: &'static str,
    face: &'static str,
    base: [&'static str; 2],
}

const DESIGNS: [Design; 8] = [
    Design { head: " /\\_/\\ ", face: "( E.E )", base: [" /| |\\ ", " \\| |/ "] }, // 0 余烬狐:幻想,四足
    Design { head: " ,~~~, ", face: "((E.E))", base: [" ~ ~ ~ ", "  ~~~  "] },    // 1 云絮:幻想,悬浮
    Design { head: " |\\_/| ", face: "=(E.E)=", base: [" (___)>", " (___)<"] }, // 2 猫:现实,四足
    Design { head: " /^^^\\ ", face: "d(E.E)b", base: [" /|_|\\ ", " \\|_|/ "] }, // 3 狗:现实,四足
    Design { head: " [===] ", face: "|[E.E]|", base: [" _| |_ ", " |_ _| "] },   // 4 方块机器人:机械,双足
    Design { head: " -o-o- ", face: "<(E.E)>", base: ["  ^ ^  ", "  v v  "] },   // 5 无人机:机械,悬浮
    Design { head: " \\\\|// ", face: " (E.E) ", base: ["  /|\\  ", "  \\|/  "] }, // 6 芽苗:植物,扎根
    Design { head: " ,^^^, ", face: "{ E.E }", base: [" /\\/\\/ ", " \\/\\/\\ "] }, // 7 余火:元素,四足
];

fn eye_for(pose: Pose, blink: bool, unicode: bool) -> char {
    match pose {
        Pose::Sick | Pose::End => 'x',
        Pose::Sleep => '-',
        Pose::Startled => 'O',
        Pose::Observe => '0',
        Pose::Evolve => '*',
        _ if blink => '-',
        _ if unicode => '\u{25cf}',
        _ => 'o',
    }
}

fn sprite(i: &FrameInput, blink: bool, step: u64) -> [String; 3] {
    let d = &DESIGNS[(i.species % SPECIES_COUNT) as usize];
    let unicode = matches!(i.charset, Charset::Unicode);
    let eye = eye_for(i.pose, blink, unicode);
    let mut head = String::from(d.head);
    match i.pose {
        Pose::Sleep => {
            head.pop();
            head.push('z');
        }
        Pose::Evolve => {
            // 进化:头部两侧闪烁星光,随时钟交替。
            let spark = if step.is_multiple_of(2) { '*' } else { '+' };
            head = head.chars().enumerate().map(|(n, c)| if n == 0 || n == 6 { spark } else { c }).collect();
        }
        _ => {}
    }
    let mut face = String::new();
    for c in d.face.chars() {
        face.push(if c == 'E' { eye } else { c });
    }
    let mut base = String::from(d.base[(step % 2) as usize]);
    match i.pose {
        // 进食:嘴部开合。
        Pose::Eat if step.is_multiple_of(2) => {
            face = face.replacen('.', "o", 1);
        }
        // 终结:坐在纪念台上并静止,与生病在不看颜色时也能区分。
        Pose::End => base = " ._._. ".into(),
        // 玩耍:下半身整行换成蹦跳的样子。
        Pose::Play => base = if step.is_multiple_of(2) { "  \\o/  ".into() } else { "  /o\\  ".into() },
        _ => {}
    }
    [head, face, base]
}

/// 合成一帧字符单元网格。尺寸小于精灵时裁剪,不 panic。
pub fn render(i: &FrameInput) -> Frame {
    let (w, h) = (i.w.max(1), i.h.max(1));
    let mut cells: Vec<Vec<(char, u8)>> = (0..h).map(|_| (0..w).map(|_| (' ', 0)).collect()).collect();

    let body = body_of(i.species);
    // 只有待机会位移(扎根者原地摇摆);其余姿态停在原地。
    let moving = matches!(i.pose, Pose::Idle);
    let animated = matches!(i.pose, Pose::Idle | Pose::Eat | Pose::Play | Pose::Evolve | Pose::Startled);
    let walking = moving && body != Body::Rooted;
    let span = w.saturating_sub(SPRITE_W) as u64;
    let x0 = if walking && span > 0 {
        let period = span * 2;
        let pos = (i.t / 2) % period;
        if pos <= span { pos } else { period - pos }
    } else {
        span / 2
    };
    let step = if animated { i.t / 2 } else { 0 };
    let blink = i.t % 40 >= 38;
    // 悬浮者上下起伏更明显(两格),行走者一格。
    let bob_amp = if body == Body::Floater { 2 } else { 1 };
    let bob = if (walking || matches!(i.pose, Pose::Play)) && step % 2 == 1 { bob_amp.min(h.saturating_sub(SPRITE_H)) } else { 0 };
    let y0 = h.saturating_sub(SPRITE_H + bob);
    let color = match i.pose {
        Pose::Sick | Pose::End => 244,
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
