// 构建 pet/packages/pet-sdk 并把产物同步到 src/features/pet-demo/sdk,供 /pet 演示页经 import.meta.glob 加载。
// 需要 cargo、wasm32-unknown-unknown 目标与 wasm-bindgen;产物已在 .gitignore,不入库。
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const sdk = resolve(here, "../../pet/packages/pet-sdk");
const target = resolve(here, "../src/features/pet-demo/sdk");

const build = spawnSync("sh", [resolve(sdk, "build.sh")], { stdio: "inherit" });
if (build.status !== 0) process.exit(build.status ?? 1);

const dist = resolve(sdk, "dist");
if (!existsSync(resolve(dist, "pet_wasm_bg.wasm"))) {
	console.error("pet-sdk 构建产物缺失");
	process.exit(1);
}
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
for (const f of ["index.js", "pet_wasm.js", "pet_wasm_bg.wasm"]) {
	cpSync(resolve(dist, f), resolve(target, f));
}
console.log(`已同步到 ${target}`);
