# 开发与调试入口。独立成仓库后原样可用;在 Violet 单仓里用 `make -C pet <目标>`。
.DEFAULT_GOAL := help
SUB ?= alice

.PHONY: help test lint wasm schema schema-check three-end term preview dev dev-init token e2e e2e-pg consumers clean

help: ## 列出全部目标
	@grep -E '^[a-z0-9-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-14s %s\n", $$1, $$2}'

test: ## 全部 Rust 测试
	cargo test --workspace

lint: ## clippy,与 CI 相同的 -D warnings
	cargo clippy --workspace --all-targets -- -D warnings

wasm: ## 构建 SDK(wasm-bindgen web target)到 packages/pet-sdk/dist
	packages/pet-sdk/build.sh

schema: ## 由 Rust 类型重新生成 schema、TypeScript 类型与能力文档
	packages/pet-sdk/scripts/gen.sh

schema-check: ## 生成物不得与 Rust 类型不同源;转录校验与类型测试
	packages/pet-sdk/scripts/check-schema.sh

three-end: ## 原生、浏览器 WebAssembly、Node WebAssembly 三端输出逐字节比较
	sh scripts/three-end.sh

term: ## 在终端里养一只宠物
	cargo run -p pet-cli -- live

preview: ## 打印全部物种与姿态的字符画
	cargo run -p pet-term --example preview

dev-init: ## 生成 .dev/ 里的开发密钥与环境(已存在则保留)
	node scripts/dev.mjs init

dev: ## 启动本地服务(SQLite,127.0.0.1:8787),模拟接入方由 scripts/dev.mjs 提供
	node scripts/dev.mjs serve

token: ## 以 SUB(默认 alice)换取访问令牌,供 curl 使用;需先 make dev
	@node scripts/dev.mjs token $(SUB)

e2e: ## 服务端到端(真实二进制、HTTP、重启),SQLite
	sh consumers/service-e2e.sh

e2e-pg: ## 同上,另含 Postgres(需要 Docker)
	sh scripts/service-pg.sh

consumers: ## 外部消费方验收:npm CLI、Node 嵌入、Rust 宿主、TanStack Start
	sh consumers/npm-cli.sh && sh consumers/node-embed.sh && sh consumers/rust-host.sh && sh consumers/tanstack-start/run.sh

clean: ## 删除构建产物与 .dev/
	cargo clean
	rm -rf .dev packages/pet-sdk/dist
