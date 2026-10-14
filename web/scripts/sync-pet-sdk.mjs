// 构建 kodama 仓库的 pet-sdk 并同步到 src/features/pet-demo/sdk,供 /pet 演示页经 import.meta.glob 加载。
// 需要 cargo、wasm32-unknown-unknown 目标与 wasm-bindgen;产物已在 .gitignore,不入库。
//
//   pnpm pet:sync                         构建并同步一次
//   pnpm pet:sync --watch                 监听 Rust 源码,改动后自动重建并同步(Vite 会热更新页面)
//   PET_REPO=../tama pnpm pet:sync        指向独立仓库的检出,默认是本仓库的 ../pet
//   PET_SDK_DIST=/path/to/dist pnpm pet:sync   不构建,直接拷贝已有产物
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, watch } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(process.env.PET_REPO ?? resolve(here, "../../../kodama"));
const sdk = resolve(repo, "packages/pet-sdk");
const dist = process.env.PET_SDK_DIST ? resolve(process.env.PET_SDK_DIST) : resolve(sdk, "dist");
const target = resolve(here, "../src/features/pet-demo/sdk");
const FILES = ["index.js", "pet_wasm.js", "pet_wasm_bg.wasm"];

function sync() {
	if (!process.env.PET_SDK_DIST) {
		if (!existsSync(resolve(sdk, "build.sh"))) {
			console.error(`找不到 ${sdk}/build.sh。先 git clone https://github.com/VOD-Studio/kodama 与本仓库并排,或用 PET_REPO 指向它的检出`);
			return false;
		}
		const build = spawnSync("sh", [resolve(sdk, "build.sh")], { stdio: "inherit" });
		if (build.status !== 0) return false;
	}
	if (!existsSync(resolve(dist, "pet_wasm_bg.wasm"))) {
		console.error(`SDK 构建产物缺失: ${dist}`);
		return false;
	}
	rmSync(target, { recursive: true, force: true });
	mkdirSync(target, { recursive: true });
	for (const f of FILES) cpSync(resolve(dist, f), resolve(target, f));
	console.log(`已同步 ${dist} -> ${target}`);
	return true;
}

const ok = sync();
if (process.argv.includes("--watch")) {
	const crates = resolve(repo, "crates");
	const catalog = resolve(repo, "catalog");
	let timer;
	let building = false;
	const rebuild = () => {
		clearTimeout(timer);
		timer = setTimeout(() => {
			if (building) return;
			building = true;
			sync();
			building = false;
		}, 400);
	};
	for (const dir of [crates, catalog]) {
		watch(dir, { recursive: true }, (_event, name) => {
			if (name && (name.endsWith(".rs") || name.endsWith(".json") || name.endsWith(".toml"))) rebuild();
		});
	}
	console.log("监听中:修改 Rust 源码后自动重建。Ctrl+C 退出");
} else if (!ok) {
	process.exit(1);
}
