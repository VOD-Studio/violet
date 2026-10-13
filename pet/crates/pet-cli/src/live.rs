use crossterm::event::{poll, read, Event, KeyCode, KeyEventKind, KeyModifiers};
use crossterm::style::{Color, Print, ResetColor, SetForegroundColor};
use crossterm::terminal::{self, EnterAlternateScreen, LeaveAlternateScreen};
use crossterm::{cursor, queue};
use pet_term::{render, Charset, FrameInput, Pose};
use signal_hook::consts::{SIGINT, SIGTERM};
use std::io::{IsTerminal, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

#[derive(Clone, Copy, PartialEq)]
enum ColorMode {
    None,
    Ansi16,
    Ansi256,
}

fn color_mode() -> ColorMode {
    let env = |k: &str| std::env::var(k).unwrap_or_default();
    if std::env::var_os("NO_COLOR").is_some() || env("TERM") == "dumb" || env("TERM").is_empty() {
        ColorMode::None
    } else if env("COLORTERM").contains("truecolor") || env("TERM").contains("256color") {
        ColorMode::Ansi256
    } else {
        ColorMode::Ansi16
    }
}

fn charset() -> Charset {
    let loc = ["LC_ALL", "LC_CTYPE", "LANG"].iter().find_map(|k| std::env::var(k).ok().filter(|v| !v.is_empty())).unwrap_or_default();
    if loc.to_uppercase().contains("UTF") { Charset::Unicode } else { Charset::Ascii }
}

/// 进入时接管终端,Drop 与 panic 钩子都会恢复。
struct TermGuard;

impl TermGuard {
    fn enter() -> std::io::Result<Self> {
        terminal::enable_raw_mode()?;
        let mut o = std::io::stdout();
        queue!(o, EnterAlternateScreen, cursor::Hide)?;
        o.flush()?;
        Ok(Self)
    }
}

fn restore() {
    let mut o = std::io::stdout();
    let _ = queue!(o, ResetColor, cursor::Show, LeaveAlternateScreen);
    let _ = o.flush();
    let _ = terminal::disable_raw_mode();
}

impl Drop for TermGuard {
    fn drop(&mut self) {
        restore();
    }
}

fn input(species: u8, w: u16, h: u16, t: u64, pose: Pose, cs: Charset) -> FrameInput {
    // 切片:固定演示个体;账号模式下由投影提供 species / genes。
    FrameInput { species, genes: [37, 0, 0, 0, 0, 0, 0, 0], pose, charset: cs, w, h, t }
}

/// 非 TTY:输出一行可读 JSON 状态后退出,不含任何控制码。
fn non_tty() -> i32 {
    let f = render(&input(1, 24, 4, 0, Pose::Idle, Charset::Ascii));
    println!("{}", serde_json::json!({ "pose": "idle", "frame": f.rows }));
    0
}

pub fn run() -> i32 {
    if !std::io::stdout().is_terminal() || !std::io::stdin().is_terminal() {
        return non_tty();
    }
    let stop = Arc::new(AtomicBool::new(false));
    for sig in [SIGINT, SIGTERM] {
        if signal_hook::flag::register(sig, stop.clone()).is_err() {
            eprintln!("cannot register signal handler");
            return 1;
        }
    }
    let prev = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        restore();
        prev(info);
    }));

    let guard = match TermGuard::enter() {
        Ok(g) => g,
        Err(e) => {
            eprintln!("cannot enter terminal mode: {e}");
            return 1;
        }
    };
    let (mode, cs) = (color_mode(), charset());
    let mut pose = Pose::Idle;
    let mut species = 1u8;
    let mut t = 0u64;
    let mut out = std::io::stdout();

    while !stop.load(Ordering::Relaxed) {
        let (w, h) = terminal::size().unwrap_or((40, 10));
        let f = render(&input(species, w, h.saturating_sub(1), t, pose, cs));
        let _ = queue!(out, cursor::MoveTo(0, 0));
        for (y, row) in f.rows.iter().enumerate() {
            let _ = queue!(out, cursor::MoveTo(0, y as u16));
            for (x, ch) in row.chars().enumerate() {
                let c = f.colors[y][x];
                match (mode, c) {
                    (ColorMode::None, _) | (_, 0) => {
                        let _ = queue!(out, ResetColor, Print(ch));
                    }
                    (ColorMode::Ansi256, c) => {
                        let _ = queue!(out, SetForegroundColor(Color::AnsiValue(c)), Print(ch));
                    }
                    (ColorMode::Ansi16, c) => {
                        let _ = queue!(out, SetForegroundColor(Color::AnsiValue(1 + c % 6)), Print(ch));
                    }
                }
            }
        }
        let _ = queue!(out, cursor::MoveTo(0, h.saturating_sub(1)), ResetColor, Print("q quit  i idle o look e eat p play s sleep ! scare k sick v evolve x end  n next species"));
        let _ = out.flush();

        if poll(Duration::from_millis(100)).unwrap_or(false) {
            if let Ok(Event::Key(k)) = read() {
                if k.kind == KeyEventKind::Press {
                    match k.code {
                        KeyCode::Char('c') if k.modifiers.contains(KeyModifiers::CONTROL) => break,
                        KeyCode::Char('q') | KeyCode::Esc => break,
                        KeyCode::Char('s') => pose = Pose::Sleep,
                        KeyCode::Char('i') => pose = Pose::Idle,
                        KeyCode::Char('k') => pose = Pose::Sick,
                        KeyCode::Char('o') => pose = Pose::Observe,
                        KeyCode::Char('e') => pose = Pose::Eat,
                        KeyCode::Char('p') => pose = Pose::Play,
                        KeyCode::Char('!') => pose = Pose::Startled,
                        KeyCode::Char('v') => pose = Pose::Evolve,
                        KeyCode::Char('x') => pose = Pose::End,
                        KeyCode::Char('n') => {
                            // 切换物种,便于逐个检查形象。
                            species = (species + 1) % pet_term::SPECIES_COUNT;
                        }
                        _ => {}
                    }
                }
            }
            // Resize 事件下一轮循环按新尺寸重绘;重绘前清屏避免残影。
            let _ = queue!(out, terminal::Clear(terminal::ClearType::All));
        }
        t += 1;
    }
    drop(guard);
    0
}
