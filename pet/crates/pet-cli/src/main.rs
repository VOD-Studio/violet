mod live;

use pet_core::execute;
use std::io::{BufRead, Write};

fn main() {
    match std::env::args().nth(1).as_deref() {
        Some("live") => std::process::exit(live::run()),
        None | Some("exec") => exec(),
        Some(other) => {
            eprintln!("unknown command: {other}\nusage: pet-cli [exec|live]");
            std::process::exit(2);
        }
    }
}

/// 每行一个 JSON 命令,每行输出一个 JSON 结果。
fn exec() {
    let stdin = std::io::stdin();
    let mut out = std::io::stdout().lock();
    for line in stdin.lock().lines() {
        let line = line.expect("stdin");
        if line.trim().is_empty() {
            continue;
        }
        writeln!(out, "{}", execute(&line)).expect("stdout");
    }
}
