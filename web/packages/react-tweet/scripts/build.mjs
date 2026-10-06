import { spawnSync } from "node:child_process";
import { copyFile, cp, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
await rm(new URL("dist/", root), { recursive: true, force: true });
const result = spawnSync("tsc", ["--project", "tsconfig.build.json"], {
	cwd: fileURLToPath(root),
	stdio: "inherit",
	shell: process.platform === "win32",
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
await Promise.all(
	["styles.css", "tweet/tweet.css", "tweet/media.css"].map((path) =>
		copyFile(new URL(`src/${path}`, root), new URL(`dist/${path}`, root)),
	),
);
await cp(new URL("src/tweet/icons/", root), new URL("dist/tweet/icons/", root), {
	recursive: true,
});
