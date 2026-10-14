//! 像素画风:每个物种一个 14×12 的身体模板,姿态与成长阶段以叠加方式表现,配色由基因决定。
//! 全部为整数运算。输出是调色板加像素网格,由呈现方按整数倍放大。
use crate::{body_of, u64_string, Body, Pose, SPECIES_COUNT};
use alloc::collections::BTreeMap;
use alloc::format;
use alloc::string::String;
use alloc::vec::Vec;
use serde::{Deserialize, Serialize};

pub const PIXEL_W: u16 = 14;
pub const PIXEL_H: u16 = 12;
/// 精灵上方为星光、感叹号、光环等叠加物预留的行数。
const HEADROOM: usize = 6;

/// 像素帧输入。`stage` 为 0 幼体、1 少年、2 成年;更大的值按成年处理。
#[derive(Deserialize)]
#[cfg_attr(feature = "schema", derive(schemars::JsonSchema))]
#[allow(missing_docs)]
pub struct PixelInput {
    pub species: u8,
    pub genes: [u8; 8],
    pub pose: Pose,
    pub stage: u8,
    pub w: u16,
    pub h: u16,
    #[serde(with = "u64_string")]
    #[cfg_attr(feature = "schema", schemars(with = "String"))]
    pub t: u64,
}

/// 像素网格。`rows` 的每个字符是 `palette` 的键,`.` 表示透明。
#[derive(Serialize)]
#[cfg_attr(feature = "schema", derive(schemars::JsonSchema))]
pub struct Pixels {
    pub w: u16,
    pub h: u16,
    pub rows: Vec<String>,
    /// 键为单个字符,值为 `#rrggbb`。
    pub palette: BTreeMap<String, String>,
}

/// 身体模板。`E` 为眼睛位置(第 4、9 列,第 5 行),`MM` 为嘴(第 6、7 列,第 7 行);腿部两帧交替。
struct Design {
    top: [&'static str; 10],
    legs: [[&'static str; 2]; 2],
    /// 主色相与饱和度。
    hue: u16,
    sat: u16,
    /// 点缀色相与饱和度。
    accent: (u16, u16),
}

const DESIGNS: [Design; 8] = [
    // 0 余烬狐:尖耳,耳内点缀,四足
    Design {
        top: [
            "..oo......oo..",
            ".obbo....obbo.",
            ".obabo..obabo.",
            ".obbbooooobbbo",
            "obbbbbbbbbbbbo",
            "obbbEbbbbEbbbo",
            "obbllbbbbllbbo",
            ".obllbMMbllbo.",
            ".obbbbbbbbbbo.",
            "..obbbaabbbo..",
        ],
        legs: [["..obbo..obbo..", "..oooo..oooo.."], [".obbo....obbo.", ".oooo....oooo."]],
        hue: 20,
        sat: 85,
        accent: (350, 70),
    },
    // 1 云絮:云状身体,没有脚
    Design {
        top: [
            "...ooo..oo....",
            "..oblloobllo..",
            ".oblllllllllo.",
            "oblllllllllllo",
            "obllllllllllbo",
            "obllEllllEllbo",
            "oballllllllabo",
            "obllllMMllllbo",
            ".obllllllllbo.",
            "..obbbbbbbbo..",
        ],
        legs: [["...oo.oo.oo...", "....o.o.o....."], ["..oo.oo.oo.o..", "...o.o.o.o...."]],
        hue: 205,
        sat: 60,
        accent: (340, 70),
    },
    // 2 家猫:尖耳,须,条纹,四足
    Design {
        top: [
            "..o........o..",
            ".obo......obo.",
            ".obbo....obbo.",
            ".obabooooobabo",
            "obsbbbbbbbbsbo",
            "obbbEbbbbEbbbo",
            "wwbbbbaabbbbww",
            "obbbbbMMbbbbbo",
            ".obbbbbbbbbbo.",
            "..obbsbbsbbo..",
        ],
        legs: [["..obbo..obbo..", "..oooo..oooo.."], [".obbo....obbo.", ".oooo....oooo."]],
        hue: 30,
        sat: 32,
        accent: (350, 60),
    },
    // 3 家犬:垂耳,浅色口鼻,四足
    Design {
        top: [
            "...oooooooo...",
            "..obbbbbbbbo..",
            ".obbbbbbbbbbo.",
            "ossbbbbbbbbsso",
            "ossbbbbbbbbsso",
            "osssEbbbbEssso",
            "ossbbllllbbsso",
            "ossbblMMlbbsso",
            ".osbbllllbbso.",
            "..obbbbbbbbo..",
        ],
        legs: [["..obbo..obbo..", "..oooo..oooo.."], [".obbo....obbo.", ".oooo....oooo."]],
        hue: 28,
        sat: 55,
        accent: (30, 60),
    },
    // 4 方块机器人:方头,天线,屏幕脸,双足
    Design {
        top: [
            "......aa......",
            ".......a......",
            "..oooooooooo..",
            ".obbbbbbbbbbo.",
            ".obllllllllbo.",
            ".obsbEssssEso.",
            ".obssssssssbo.",
            ".obsssMMsssbo.",
            ".obbbbbbbbbbo.",
            "..oooooooooo..",
        ],
        legs: [["..obbo..obbo..", "..oooo..oooo.."], [".obbo....obbo.", ".oooo....oooo."]],
        hue: 215,
        sat: 18,
        accent: (190, 80),
    },
    // 5 悬浮无人机:双旋翼,没有脚
    Design {
        top: [
            "oooooo..oooooo",
            "..oo......oo..",
            "...o.oooo.o...",
            "..oooooooooo..",
            ".obbbbbbbbbbo.",
            ".obbEbbbbEbbo.",
            ".obbbbbbbbbbo.",
            ".obbbbMMbbbbo.",
            "..oooooooooo..",
            "..............",
        ],
        legs: [["....a....a....", ".............."], [".....a..a.....", "....a....a...."]],
        hue: 265,
        sat: 25,
        accent: (30, 95),
    },
    // 6 芽苗:叶冠,原地摇摆
    Design {
        top: [
            "..aaa....aaa..",
            ".aaaaa..aaaaa.",
            ".aaaaaaaaaaaa.",
            "..oaaaaaaaao..",
            "..obbbbbbbbo..",
            ".obbEbbbbEbbo.",
            ".obbbbbbbbbbo.",
            ".obbbbMMbbbbo.",
            ".obbbbbbbbbbo.",
            "..oobbbbbboo..",
        ],
        legs: [["...obo..obo...", "..oo.o..o.oo.."], ["...obo..obo...", ".oo..o..o..oo."]],
        hue: 95,
        sat: 40,
        accent: (130, 60),
    },
    // 7 余火:火冠,四足
    Design {
        top: [
            ".....a..a.....",
            "....aaaaaa....",
            "...aaaaaaaa...",
            "..oabbbbbbao..",
            ".obbbbbbbbbbo.",
            ".obbEbbbbEbbo.",
            ".obbbbbbbbbbo.",
            ".obbbbMMbbbbo.",
            ".obbbbbbbbbbo.",
            "..obbbbbbbbo..",
        ],
        legs: [["...obo..obo...", "...ooo..ooo..."], ["..obo....obo..", "..ooo....ooo.."]],
        hue: 8,
        sat: 90,
        accent: (48, 95),
    },
];

/// 整数 HSL 转 `#rrggbb`。`h` 为度,`s`、`l` 为百分比。
fn hsl(h: i32, s: i32, l: i32) -> String {
    let h = h.rem_euclid(360);
    let (s, l) = (s.clamp(0, 100), l.clamp(0, 100));
    let c = (100 - (2 * l - 100).abs()) * s / 100;
    let x = c * (60 - ((h % 120) - 60).abs()) / 60;
    let m = l - c / 2;
    let (r, g, b) = match h / 60 {
        0 => (c, x, 0),
        1 => (x, c, 0),
        2 => (0, c, x),
        3 => (0, x, c),
        4 => (x, 0, c),
        _ => (c, 0, x),
    };
    let ch = |v: i32| ((v + m).clamp(0, 100) * 255 / 100) as u8;
    format!("#{:02x}{:02x}{:02x}", ch(r), ch(g), ch(b))
}

fn palette(d: &Design, genes: &[u8; 8], pose: Pose, flash: bool) -> BTreeMap<String, String> {
    let shift = (genes[0] % 41) as i32 - 20;
    let light = (genes[1] % 7) as i32 - 3;
    let (mut h, mut s) = (d.hue as i32 + shift, d.sat as i32);
    let mut lift = if flash { 14 } else { 0 };
    let mut accent = d.accent;
    match pose {
        // 生病:偏青灰,没有颜色也能靠汗滴与眼睛辨认。
        Pose::Sick => {
            h = 110;
            s = s * 4 / 10;
        }
        // 终结:去色。
        Pose::End => {
            s = 0;
            accent.1 = 0;
            lift = -4;
        }
        _ => {}
    }
    let mut p = BTreeMap::new();
    let mut put = |k: &str, v: String| {
        p.insert(String::from(k), v);
    };
    put("o", hsl(h, 30, 16));
    put("b", hsl(h, s, 58 + light + lift));
    put("s", hsl(h, s, 42 + light + lift));
    put("l", hsl(h, s, 78 + light + lift));
    put("a", hsl(accent.0 as i32, accent.1 as i32, 60 + lift));
    put("w", String::from("#ffffff"));
    put("k", hsl(h, 30, 10));
    put("m", String::from("#c0365a"));
    put("y", String::from("#ffd23f"));
    put("r", String::from("#e5484d"));
    put("c", String::from("#5ac8fa"));
    put("g", String::from("#8a8794"));
    p
}

type Layer = [[char; PIXEL_W as usize]; HEADROOM + PIXEL_H as usize];

fn put(layer: &mut Layer, x: i32, y: i32, ch: char) {
    let (x, y) = (x, y + HEADROOM as i32);
    if x >= 0 && y >= 0 && (x as usize) < PIXEL_W as usize && (y as usize) < layer.len() {
        layer[y as usize][x as usize] = ch;
    }
}

fn eyes(layer: &mut Layer, pose: Pose, blink: bool) {
    for (x, mirror) in [(4i32, false), (9, true)] {
        // 模板里的 E 位置先清成身体色,再按姿态画眼。
        put(layer, x, 5, 'b');
        match pose {
            Pose::Sleep => {
                let (a, b) = if mirror { (9, 10) } else { (3, 4) };
                put(layer, a, 6, 'k');
                put(layer, b, 6, 'k');
            }
            Pose::Sick | Pose::End => {
                for (dx, dy) in [(-1, 0), (1, 0), (0, 1), (-1, 2), (1, 2)] {
                    put(layer, x + dx, 5 + dy, 'k');
                }
            }
            Pose::Startled => {
                for dy in -1..=1 {
                    put(layer, x, 5 + dy, 'k');
                    put(layer, x + if mirror { 1 } else { -1 }, 5 + dy, 'w');
                }
            }
            Pose::Evolve => {
                put(layer, x, 5, 'y');
                put(layer, x, 6, 'y');
            }
            _ if blink => {
                let (a, b) = if mirror { (9, 10) } else { (3, 4) };
                put(layer, a, 6, 'k');
                put(layer, b, 6, 'k');
            }
            _ => {
                let gaze = if matches!(pose, Pose::Observe) { 1 } else { 0 };
                put(layer, x + gaze, 5, 'k');
                put(layer, x + gaze, 6, 'k');
                put(layer, x + gaze - 1, 5, 'w');
            }
        }
    }
}

fn mouth(layer: &mut Layer, pose: Pose, step: u64) {
    let open = matches!(pose, Pose::Eat) && step.is_multiple_of(2) || matches!(pose, Pose::Startled);
    let ch = if open { 'm' } else { 'o' };
    put(layer, 6, 7, ch);
    put(layer, 7, 7, ch);
    if open {
        put(layer, 6, 8, 'm');
        put(layer, 7, 8, 'm');
    }
}

/// 头顶中央最高的不透明像素所在行,点缀物贴着它放置。
fn crown_row(layer: &Layer) -> i32 {
    (0..layer.len()).find(|&y| matches!(layer[y][6], c if c != '.') || layer[y][7] != '.').map_or(0, |y| y as i32 - HEADROOM as i32)
}

fn overlays(layer: &mut Layer, pose: Pose, stage: u8, step: u64) {
    let top = crown_row(layer);
    match stage {
        0 => {}
        1 => {
            // 少年:头顶长出一小撮点缀色。
            for x in 6..=7 {
                put(layer, x, top - 1, 'a');
            }
            put(layer, 6, top - 2, 'a');
        }
        _ => {
            // 成年:金色小冠,中间嵌一颗红宝石。
            for x in 5..=8 {
                put(layer, x, top - 1, 'y');
            }
            put(layer, 5, top - 2, 'y');
            put(layer, 8, top - 2, 'y');
            put(layer, 6, top - 2, 'r');
            put(layer, 7, top - 2, 'y');
        }
    }
    match pose {
        Pose::Sleep => {
            // 飘起的 z,两帧大小交替。
            let (x, y) = if step.is_multiple_of(2) { (11, -1) } else { (12, -3) };
            for (dx, dy) in [(0, 0), (1, 0), (1, 1), (0, 2), (1, 2)] {
                put(layer, x + dx - 1, y + dy, 'c');
            }
        }
        Pose::Startled => {
            for dy in -4..=-3 {
                put(layer, 7, dy, 'r');
            }
            put(layer, 7, -1, 'r');
        }
        Pose::Sick => {
            put(layer, 12, 3, 'c');
            put(layer, 12, 4, 'c');
        }
        Pose::Play => {
            let o = if step.is_multiple_of(2) { 0 } else { 1 };
            put(layer, 0, 1 + o, 'y');
            put(layer, 13, 2 - o, 'y');
        }
        Pose::Eat => {
            if step.is_multiple_of(2) {
                put(layer, 3, 9, 'r');
                put(layer, 10, 9, 'r');
            }
        }
        Pose::Evolve => {
            let on = if step.is_multiple_of(2) { 'y' } else { 'w' };
            for (x, y) in [(0, -2), (13, -2), (0, 5), (13, 6), (3, -4), (10, -4)] {
                put(layer, x, y, on);
            }
        }
        Pose::End => {
            for x in 4..=9 {
                put(layer, x, -3, 'y');
            }
            put(layer, 3, -2, 'y');
            put(layer, 10, -2, 'y');
            for x in 2..=11 {
                put(layer, x, 11, 'g');
            }
        }
        _ => {}
    }
}

/// 合成一帧像素网格;尺寸小于精灵时裁剪,不 panic。
pub fn render_pixels(i: &PixelInput) -> Pixels {
    let (w, h) = (i.w.max(1), i.h.max(1));
    let d = &DESIGNS[(i.species % SPECIES_COUNT) as usize];
    let body = body_of(i.species);
    let moving = matches!(i.pose, Pose::Idle);
    let animated = matches!(i.pose, Pose::Idle | Pose::Eat | Pose::Play | Pose::Evolve | Pose::Startled);
    let walking = moving && body != Body::Rooted;
    let span = w.saturating_sub(PIXEL_W) as u64;
    let x0 = if walking && span > 0 {
        let period = span * 2;
        let pos = (i.t / 2) % period;
        if pos <= span { pos } else { period - pos }
    } else {
        span / 2
    };
    let step = if animated { i.t / 2 } else { 0 };
    let blink = i.t % 40 >= 38;

    let mut layer: Layer = [['.'; PIXEL_W as usize]; HEADROOM + PIXEL_H as usize];
    let frame = (step % 2) as usize;
    let rows: Vec<&str> = d.top.iter().copied().chain(d.legs[frame].iter().copied()).collect();
    for (y, row) in rows.iter().enumerate() {
        for (x, c) in row.chars().enumerate().take(PIXEL_W as usize) {
            layer[y + HEADROOM][x] = c;
        }
    }
    if matches!(i.pose, Pose::End) {
        // 终结者不再站立:去掉腿部,坐在纪念台上。
        for row in layer.iter_mut().skip(HEADROOM + 10) {
            *row = ['.'; PIXEL_W as usize];
        }
    }
    eyes(&mut layer, i.pose, blink);
    mouth(&mut layer, i.pose, step);
    overlays(&mut layer, i.pose, i.stage, step);

    // 行走与玩耍时上下起伏一格;悬浮者起伏两格。
    let amp: u16 = if body == Body::Floater { 2 } else { 1 };
    let bob = if (walking || matches!(i.pose, Pose::Play)) && step % 2 == 1 { amp } else { 0 };
    let top = h as i32 - PIXEL_H as i32 - bob as i32 - HEADROOM as i32;

    let mut grid: Vec<Vec<char>> = (0..h).map(|_| (0..w).map(|_| '.').collect()).collect();
    for (ly, line) in layer.iter().enumerate() {
        let y = top + ly as i32;
        if y < 0 || y >= h as i32 {
            continue;
        }
        for (lx, ch) in line.iter().enumerate() {
            let x = x0 as usize + lx;
            if *ch != '.' && x < w as usize {
                grid[y as usize][x] = *ch;
            }
        }
    }
    // E 与 M 只是占位,模板之外不应出现;统一抹掉以防遗漏。
    for row in grid.iter_mut() {
        for c in row.iter_mut() {
            if matches!(*c, 'E' | 'M') {
                *c = 'b';
            }
        }
    }
    let flash = matches!(i.pose, Pose::Evolve) && step.is_multiple_of(2);
    Pixels {
        w,
        h,
        rows: grid.iter().map(|r| r.iter().collect()).collect(),
        palette: palette(d, &i.genes, i.pose, flash),
    }
}
