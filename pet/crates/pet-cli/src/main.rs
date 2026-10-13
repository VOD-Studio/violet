mod live;

use pet_core::execute;
use std::io::{BufRead, Write};

fn main() {
    match std::env::args().nth(1).as_deref() {
        Some("live") => std::process::exit(live::run()),
        Some("capabilities") => println!("{}", execute("{\"op\":\"capabilities\"}")),
        Some("help" | "--help" | "-h") => help(),
        None | Some("exec") => exec(),
        Some(other) => {
            eprintln!("unknown command: {other}\nrun `pet-cli help`");
            std::process::exit(2);
        }
    }
}

/// 帮助文本中的能力列表与机器可读发现同源(pet_core::CAPABILITIES)。
fn help() {
    println!("usage: pet-cli [exec|live|capabilities|help]\n");
    println!("  exec          read one JSON command per line on stdin, write one JSON result per line");
    println!("  live          interactive terminal pet (non-TTY: one JSON status line)");
    println!("  capabilities  print the machine-readable capability catalog\n");
    println!("ops accepted by exec (rules v{}):", pet_core::RULES_VERSION);
    for c in pet_core::CAPABILITIES {
        let errors: Vec<String> = c.errors.iter().map(|e| format!("{e:?}")).collect();
        let errors = if errors.is_empty() { "-".to_string() } else { errors.join(", ") };
        println!("  {:<13} {}{}\n  {:<13} errors: {}", c.op, c.summary, if c.mutates_state { " [mutates state]" } else { "" }, "", errors);
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
