#!/bin/sh
# 外部 Rust 项目以依赖方式嵌入宠物:测试通过且输出不含接管终端的控制序列。
set -e
cd "$(dirname "$0")/rust-host"
cargo test -q
OUT=$(cargo run -q)
case "$OUT" in *"$(printf '\033[?1049')"*|*"$(printf '\033[?25')"*) echo "FAIL: host output takes over the terminal"; exit 1;; esac
echo "PASS: rust host embeds the pet inside its own rectangle without taking over the terminal"
