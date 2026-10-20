// @vitest-environment node
import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, expect, it } from "vitest";

const cliEntry = fileURLToPath(import.meta.resolve("@tanstack/router-cli"));
let fixture: string;

beforeEach(() => {
	fixture = realpathSync(mkdtempSync(join(tmpdir(), "violet-route-generation-")));
	mkdirSync(join(fixture, "src/routes"), { recursive: true });
	writeFileSync(
		join(fixture, "src/routes/__root.tsx"),
		`import { createRootRoute } from "@tanstack/react-router";
export const Route = createRootRoute({});
`,
	);
	writeRoute("index", "/");
});

afterEach(() => {
	rmSync(fixture, { recursive: true, force: true });
});

function writeRoute(name: string, path: string) {
	writeFileSync(
		join(fixture, `src/routes/${name}.tsx`),
		`import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute(${JSON.stringify(path)})({});
`,
	);
}

function generateRoutes() {
	const result = spawnSync(process.execPath, [cliEntry, "generate"], {
		cwd: fixture,
		encoding: "utf8",
		timeout: 15_000,
	});
	if (result.error) throw result.error;
	return result;
}

it("已有生成物时仍以失败退出码报告路由冲突", () => {
	const initial = generateRoutes();
	expect(initial.status, initial.stderr).toBe(0);
	const generatedPath = join(fixture, "src/routeTree.gen.ts");
	const previous = readFileSync(generatedPath, "utf8");

	writeRoute("(first).collision", "/(first)/collision");
	writeRoute("(second).collision", "/(second)/collision");
	const result = generateRoutes();

	expect(result.status, result.stderr).toBe(1);
	expect(readFileSync(generatedPath, "utf8")).toBe(previous);
});

it("缺少根路由时失败退出而不是报告生成成功", () => {
	rmSync(join(fixture, "src/routes/__root.tsx"));

	const result = generateRoutes();

	expect(result.status, result.stderr).toBe(1);
	expect(existsSync(join(fixture, "src/routeTree.gen.ts"))).toBe(false);
});
