// @vitest-environment node
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, expect, it } from "vitest";

const cli = fileURLToPath(new URL("./check-colors.mjs", import.meta.url));
const config = JSON.parse(
	readFileSync(new URL("../color-guard.config.json", import.meta.url), "utf8"),
);
let fixture: string;

function write(name: string, contents: string) {
	const path = join(fixture, name);
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, contents);
}

function git(...args: string[]) {
	const result = spawnSync("git", args, { cwd: fixture, encoding: "utf8" });
	if (result.status !== 0) throw new Error(result.stderr);
	return result.stdout.trim();
}

function commit() {
	git("add", ".");
	git(
		"-c",
		"user.name=Color fixture",
		"-c",
		"user.email=fixture@example.invalid",
		"commit",
		"-qm",
		"fixture",
	);
}

function check(...args: string[]) {
	const result = spawnSync(process.execPath, [cli, ...args], {
		cwd: fixture,
		encoding: "utf8",
		timeout: 15_000,
		env: { ...process.env, COLOR_GUARD_BASE: "HEAD" },
	});
	if (result.error) throw result.error;
	return result;
}

beforeEach(() => {
	fixture = realpathSync(mkdtempSync(join(tmpdir(), "violet-color-guard-")));
	write(
		"src/Card.tsx",
		'export const Card = () => <div className="bg-background text-foreground" />;\n',
	);
	write("color-guard.config.json", JSON.stringify({ ...config, initialRevision: "HEAD" }));
	write(config.baseline, JSON.stringify({ version: 1, entries: [] }));
	git("init", "-q");
	commit();
});

afterEach(() => rmSync(fixture, { recursive: true, force: true }));

it("新增 TSX 原生色板类与裸色值时失败并指出源码行号", () => {
	write(
		"src/New.tsx",
		`export const New = () => (
	<div className="dark:hover:bg-red-500/30" style={{ color: "#Ff00AA" }} />
);
`,
	);
	const result = check();
	expect(result.status, result.stdout).toBe(1);
	expect(result.stderr).toMatch(/src\/New\.tsx:2:\d+.*tailwind-palette/);
	expect(result.stderr).toMatch(/src\/New\.tsx:2:\d+.*raw-color/);
});

it("CSS 声明、@apply 与旧颜色类都受检查", () => {
	write(
		"src/new.css",
		`.card {
	color: oklch(0.7 0.2 30);
	background: rgb(10 20 30 / var(--opacity));
	border-color: hsl(240 30% 40%);
	@apply text-primary-base bg-neon-blue border-paper-300 ring-persona-accent text-white;
}
`,
	);
	const result = check();
	expect(result.status).toBe(1);
	for (const line of [2, 3, 4]) {
		expect(result.stderr).toMatch(new RegExp(`src/new\\.css:${line}:\\d+.*raw-color`));
	}
	for (const value of [
		"text-primary-base",
		"bg-neon-blue",
		"border-paper-300",
		"ring-persona-accent",
	]) {
		expect(result.stderr).toContain(`[legacy-color] ${value}`);
	}
	expect(result.stderr).toContain("[tailwind-palette] text-white");
});

it("模板字符串、转义字符串与 JSX 类名不能绕过检查", () => {
	write(
		"src/New.tsx",
		`const color = "\\u0023abcdef";
const classes = \`bg-background \${active ? "text-gray-500" : ""} bg-paper\`;
export const New = () => <div className="neon-glow paper persona primary-base" />;
`,
	);
	const result = check();
	expect(result.status).toBe(1);
	for (const value of [
		"#abcdef",
		"text-gray-500",
		"bg-paper",
		"neon-glow",
		"paper",
		"persona",
		"primary-base",
	]) {
		expect(result.stderr).toContain(value);
	}
});

it("语义变量、注释、链接与 CSS ID 不被当作颜色", () => {
	write(
		"src/clean.css",
		`/* #abc rgb(1 2 3) bg-red-500 */
#abc { color: var(--foreground); background: hsl(var(--primary) / 0.5); filter: url(#def); }
.card { color: oklch(from var(--primary) l c h); }
`,
	);
	write(
		"src/Clean.tsx",
		`// "#abc bg-red-500"
export const Clean = () => <a href={"#abc"} id="def" className="bg-background text-primary/50" style={{ color: "var(--foreground)", filter: "url(#def)" }}>#abc</a>;
`,
	);
	const result = check();
	expect(result.status, result.stderr).toBe(0);
});

const oldEntry = { file: "src/old.css", rule: "raw-color", value: "#123456", count: 1 };

function seedBaseline() {
	write(oldEntry.file, ".card { color: #123456; }\n");
	write(config.baseline, JSON.stringify({ version: 1, entries: [oldEntry] }));
	commit();
}

it("存量违规改变行号仍通过，重复一处则失败", () => {
	seedBaseline();
	write(oldEntry.file, "\n\n.card { color: #123456; }\n");
	const moved = check();
	expect(moved.status, moved.stderr).toBe(0);
	write(oldEntry.file, "\n\n.card { color: #123456; }\n.extra { color: #123456; }\n");
	const copied = check();
	expect(copied.status).toBe(1);
	expect(copied.stderr).toMatch(/src\/old\.css:4:\d+.*#123456/);
});

it("将新增违规同时加入白名单仍失败", () => {
	write(oldEntry.file, ".card { color: #123456; }\n");
	write(config.baseline, JSON.stringify({ version: 1, entries: [oldEntry] }));
	const result = check();
	expect(result.status).toBe(1);
	expect(result.stderr).toContain("[baseline-growth]");
});

it("已提交的白名单次数增长也不能绕过显式基准", () => {
	seedBaseline();
	const base = git("rev-parse", "HEAD");
	write(oldEntry.file, ".card { color: #123456; background: #123456; }\n");
	write(config.baseline, JSON.stringify({ version: 1, entries: [{ ...oldEntry, count: 2 }] }));
	commit();
	const result = check("--base", base);
	expect(result.status).toBe(1);
	expect(result.stderr).toContain("[baseline-growth]");
});

it("删除存量违规并删除对应白名单通过", () => {
	seedBaseline();
	write(oldEntry.file, ".card { color: var(--foreground); }\n");
	write(config.baseline, JSON.stringify({ version: 1, entries: [] }));
	const result = check();
	expect(result.status, result.stderr).toBe(0);
});

it("减少同类违规次数并同步减少白名单通过", () => {
	write(oldEntry.file, ".card { color: #123456; background: #123456; }\n");
	write(config.baseline, JSON.stringify({ version: 1, entries: [{ ...oldEntry, count: 2 }] }));
	commit();
	write(oldEntry.file, ".card { color: #123456; }\n");
	write(config.baseline, JSON.stringify({ version: 1, entries: [oldEntry] }));
	const result = check();
	expect(result.status, result.stderr).toBe(0);
});

it("源码删除后不能保留可复用的空闲白名单额度", () => {
	seedBaseline();
	write(oldEntry.file, ".card { color: var(--foreground); }\n");
	const result = check();
	expect(result.status).toBe(1);
	expect(result.stderr).toContain("[baseline-stale]");
});

it("只删除白名单而保留违规时仍失败", () => {
	seedBaseline();
	write(config.baseline, JSON.stringify({ version: 1, entries: [] }));
	const result = check();
	expect(result.status).toBe(1);
	expect(result.stderr).toMatch(/src\/old\.css:1:\d+.*raw-color/);
});

it("首次引入基线仅接纳固定旧提交已有的违规", () => {
	git("rm", config.baseline);
	write(oldEntry.file, ".card { color: #123456; }\n");
	commit();
	const initial = git("rev-parse", "HEAD");
	write("color-guard.config.json", JSON.stringify({ ...config, initialRevision: initial }));
	write(config.baseline, JSON.stringify({ version: 1, entries: [oldEntry] }));
	const accepted = check("--base", initial);
	expect(accepted.status, accepted.stderr).toBe(0);
	write("src/new.css", ".new { color: #abcdef; }\n");
	write(
		config.baseline,
		JSON.stringify({
			version: 1,
			entries: [oldEntry, { ...oldEntry, file: "src/new.css", value: "#abcdef" }],
		}),
	);
	commit();
	const rejected = check("--base", initial);
	expect(rejected.status).toBe(1);
	expect(rejected.stderr).toContain("[baseline-growth]");
	expect(rejected.stderr).toContain("src/new.css");
});

it("Git 基准不可读时失败而非跳过白名单对比", () => {
	const result = check("--base", "missing-baseline-ref");
	expect(result.status).toBe(1);
	expect(result.stderr).toContain("Git 基准读取失败");
});

it("从 monorepo 子目录读取同一 Git 树中的白名单", () => {
	write("web/color-guard.config.json", JSON.stringify({ ...config, initialRevision: "HEAD" }));
	write(`web/${oldEntry.file}`, ".card { color: #123456; }\n");
	write(`web/${config.baseline}`, JSON.stringify({ version: 1, entries: [oldEntry] }));
	commit();
	const result = spawnSync(process.execPath, [cli, "--base", "HEAD"], {
		cwd: join(fixture, "web"),
		encoding: "utf8",
		timeout: 15_000,
	});
	expect(result.status, result.stderr).toBe(0);
});

it.each([
	"packages/theme/src/generated.css",
	"packages/ui/src/palette.generated.css",
	"packages/ui/src/classes.css",
	"src/shared/vendor/external.css",
	"packages/ui/src/vendor/external.css",
	"src/features/lab/example.css",
	"src/routes/lab.tsx",
	"src/routes/lab.theme.tsx",
	"src/routes/lab/example.tsx",
])("配置中的豁免范围不报告违规：%s", (file) => {
	write(
		file,
		file.endsWith(".css")
			? ".x { color: #abc; }"
			: 'export const X = <div className="bg-red-500" />;',
	);
	const result = check();
	expect(result.status, result.stderr).toBe(0);
});

it.each([
	"packages/themer/src/color.css",
	"src/shared/vendor-example/color.css",
	"src/features/laboratory/color.css",
	"packages/ui/src/styles/palettes/custom.css",
])("相近目录与手写色板不扩大豁免：%s", (file) => {
	write(file, ".x { color: #abc; }");
	const result = check();
	expect(result.status).toBe(1);
	expect(result.stderr).toContain(`${file}:1:`);
});
