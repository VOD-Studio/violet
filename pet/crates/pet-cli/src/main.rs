use pet_core::execute;
use std::io::{BufRead, Write};

/// 每行一个 JSON 命令,每行输出一个 JSON 结果。
fn main() {
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
