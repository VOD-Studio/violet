// 打包 tarball，在工作区外的临时项目中安装，验证发布内容、类型、Node 运行与真实 Chromium 中的导入。
// 用法：node scripts/consumer-smoke.mjs [--keep]；需要已安装 Playwright Chromium。
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { build } from "esbuild";

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const packageJson = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8"));
const packageRequire = createRequire(resolve(packageRoot, "package.json"));
const temporaryRoot = realpathSync(mkdtempSync(resolve(tmpdir(), "theme-consumer-")));
const consumerRoot = resolve(temporaryRoot, "consumer");
mkdirSync(consumerRoot);
const keep = process.argv.includes("--keep");

const run = (command, args, cwd) => {
	const result = spawnSync(command, args, { cwd, stdio: "inherit", env: process.env });
	assert.equal(result.status, 0, `${command} ${args.join(" ")} failed.`);
};
const output = (command, args, cwd) => {
	const result = spawnSync(command, args, { cwd, encoding: "utf8", env: process.env });
	assert.equal(result.status, 0, `${command} ${args.join(" ")} failed.\n${result.stderr}`);
	return result.stdout;
};
const write = (name, contents) => writeFileSync(resolve(consumerRoot, name), contents);
const installedVersion = (name) => JSON.parse(readFileSync(packageRequire.resolve(`${name}/package.json`), "utf8")).version;

// Node 与浏览器执行同一段脚本，输出须逐字相同，保证 SSR 与客户端生成的颜色一致
const usage = `import { generateScales, normalizeTheme, toCssVariables } from "${packageJson.name}";
const theme = normalizeTheme({ version: 1, seed: "#3A7BD5", knobs: { neutralChroma: 0.02, unknown: 1 } });
if (theme.seed !== "#3a7bd5" || "unknown" in theme.knobs) throw new Error("normalizeTheme did not normalize");
if (normalizeTheme({ version: 1, seed: "#fff;}" }).seed !== normalizeTheme(null).seed) throw new Error("normalizeTheme accepted CSS");
const light = generateScales(theme, { appearance: "light" });
const dark = generateScales(theme, { appearance: "dark" });
const css = toCssVariables([light, dark]);
const declarations = css.match(/--[a-z]+-(?:\\d+|contrast): light-dark\\(oklch\\([^)]+\\), oklch\\([^)]+\\)\\);/g) ?? [];
if (declarations.length !== 26) throw new Error("Expected 26 custom properties, got " + declarations.length);
export const result = css;
`;

try {
	run("pnpm", ["pack", "--pack-destination", temporaryRoot], packageRoot);
	const tarball = resolve(
		temporaryRoot,
		readdirSync(temporaryRoot).find((name) => name.endsWith(".tgz")),
	);

	const files = output("tar", ["-tzf", tarball], temporaryRoot)
		.split("\n")
		.filter(Boolean)
		.map((path) => path.replace(/^package\//, ""));
	for (const required of [
		"package.json",
		"README.md",
		"README.zh-CN.md",
		"LICENSE",
		"dist/index.js",
		"dist/index.d.ts",
	])
		assert.ok(files.includes(required), `Tarball is missing ${required}.`);
	for (const path of files)
		assert.ok(
			/^(?:package\.json|README(?:\.zh-CN)?\.md|LICENSE|dist\/[\w-]+\.(?:js|d\.ts))$/.test(path),
			`Tarball should not contain ${path}.`,
		);

	const packed = JSON.parse(output("tar", ["-xzOf", tarball, "package/package.json"], temporaryRoot));
	assert.equal(packed.private, undefined, "Packed manifest must not be private.");
	assert.equal(packed.license, "MIT");
	assert.equal(packed.sideEffects, false);
	assert.equal(packed.types, "./dist/index.d.ts");
	assert.deepEqual(packed.exports, packageJson.publishConfig.exports, "Packed manifest must keep every public entry.");
	assert.deepEqual(packed.dependencies ?? {}, {}, "Runtime must stay dependency-free.");
	console.log("Tarball file whitelist, manifest and zero runtime dependencies passed.");

	write(
		"package.json",
		`${JSON.stringify(
			{
				name: "theme-independent-consumer",
				private: true,
				type: "module",
				dependencies: { [packageJson.name]: `file:${tarball}` },
				devDependencies: { typescript: installedVersion("typescript") },
			},
			null,
			2,
		)}\n`,
	);
	write("pnpm-workspace.yaml", "packages: []\n");
	run("pnpm", ["install", "--prefer-offline", "--ignore-scripts", "--no-frozen-lockfile"], consumerRoot);

	const consumerRequire = createRequire(resolve(consumerRoot, "package.json"));
	const entry = realpathSync(consumerRequire.resolve(packageJson.name));
	assert.ok(
		entry.startsWith(`${consumerRoot}${sep}`) && entry.endsWith(`${sep}dist${sep}index.js`),
		"Consumer resolves workspace source instead of the installed dist.",
	);
	const installedRoot = realpathSync(resolve(consumerRequire.resolve(`${packageJson.name}/package.json`), ".."));

	write(
		"types.ts",
		`import { generateScales, normalizeTheme, toCssVariables, type Appearance, type CssOptions, type Gamut, type GenerateOptions, type Knobs, type NormalizedTheme, type Scale, type Step, type Theme, type ThemeScales } from "${packageJson.name}";

const input: Theme = { version: 1, seed: "#3a7bd5", knobs: { neutralChroma: 0.02 } };
const knobs: Knobs = normalizeTheme(input).knobs;
const theme: NormalizedTheme = normalizeTheme(JSON.parse("{}") as unknown);
const appearance: Appearance = "dark";
const gamut: Gamut = "srgb";
const options: GenerateOptions = { appearance, gamut };
const scales: ThemeScales = generateScales(theme, options);
const step: Step = 9;
const scale: Scale = scales.brand;
const solid: string = scale.steps[step];
const cssOptions: CssOptions = { selector: ":root", prefix: "v-" };
const css: string = toCssVariables([scales, generateScales(theme, { appearance: "light" })], cssOptions);
// @ts-expect-error 版本号是字面量类型
const wrongVersion: Theme = { version: 2, seed: "#000000" };
// @ts-expect-error 档位只有 1–12
const wrongStep: Step = 13;
export const checks = [knobs, solid, css, wrongVersion, wrongStep];
`,
	);
	const compilerOptions = { target: "ES2022", lib: ["ES2022"], strict: true, noEmit: true, skipLibCheck: false, types: [] };
	write(
		"tsconfig.json",
		JSON.stringify({ compilerOptions: { ...compilerOptions, module: "ESNext", moduleResolution: "Bundler" }, files: ["types.ts"] }),
	);
	write(
		"tsconfig.nodenext.json",
		JSON.stringify({ compilerOptions: { ...compilerOptions, module: "NodeNext", moduleResolution: "NodeNext" }, files: ["types.ts"] }),
	);
	run("pnpm", ["exec", "tsc", "-p", "tsconfig.json"], consumerRoot);
	run("pnpm", ["exec", "tsc", "-p", "tsconfig.nodenext.json"], consumerRoot);
	console.log("Public types passed under Bundler and NodeNext resolution.");

	// 两份 README 的用法代码块取自安装后的包，原样在 Node 中执行
	for (const readme of ["README.md", "README.zh-CN.md"]) {
		const [, example] = /```ts\n([\s\S]*?)```/.exec(readFileSync(resolve(installedRoot, readme), "utf8")) ?? [];
		assert.ok(example?.includes(`from "${packageJson.name}"`), `${readme} is missing its usage example.`);
		write("readme-example.mjs", example);
		run(process.execPath, ["readme-example.mjs"], consumerRoot);
	}
	console.log("README usage examples run against the installed tarball.");

	write("usage.mjs", usage);
	const nodeResult = output(process.execPath, ["--input-type=module", "-e", `import { result } from "./usage.mjs"; process.stdout.write(result);`], consumerRoot);
	console.log("Installed tarball runs in Node.");

	const bundle = await build({
		absWorkingDir: consumerRoot,
		stdin: { contents: `import { result } from "./usage.mjs"; globalThis.themeResult = result;`, resolveDir: consumerRoot, loader: "js" },
		bundle: true,
		format: "esm",
		platform: "browser",
		write: false,
		metafile: true,
		logLevel: "silent",
	});
	for (const input of Object.keys(bundle.metafile.inputs))
		assert.ok(input === "<stdin>" || realpathSync(resolve(consumerRoot, input)).startsWith(`${consumerRoot}${sep}`), `Browser bundle leaked ${input}.`);
	const browser = await chromium.launch();
	try {
		const page = await browser.newPage();
		const errors = [];
		page.on("pageerror", (error) => errors.push(error.message));
		await page.setContent("<!doctype html><title>theme consumer</title>");
		await page.addScriptTag({ type: "module", content: bundle.outputFiles[0].text });
		const browserResult = await page.waitForFunction(() => globalThis.themeResult).then((handle) => handle.jsonValue());
		assert.deepEqual(errors, []);
		assert.equal(browserResult, nodeResult, "Browser and Node must generate identical CSS.");
		// 浏览器须能解析生成的值：按 color-scheme 取 light-dark() 的对应一支作为计算颜色
		const [, lightValue, darkValue] = /--brand-11: light-dark\((oklch\([^)]+\)), (oklch\([^)]+\))\);/.exec(nodeResult) ?? [];
		const computed = await page.evaluate((css) => {
			const style = document.createElement("style");
			style.textContent = `${css}.probe { color: var(--brand-11); }`;
			document.head.append(style);
			return ["light", "dark"].map((scheme) => {
				const probe = document.createElement("p");
				probe.className = "probe";
				probe.style.colorScheme = scheme;
				document.body.append(probe);
				return getComputedStyle(probe).color;
			});
		}, nodeResult);
		assert.deepEqual(computed, [lightValue, darkValue], "Chromium must resolve light-dark() to the generated oklch() values.");
	} finally {
		await browser.close();
	}
	console.log("Installed tarball imports in Chromium and matches the Node output.");
	console.log(`${packageJson.name}@${packageJson.version} tarball passed the independent consumer check.`);
} finally {
	if (keep) console.log(`Kept ${temporaryRoot}`);
	else rmSync(temporaryRoot, { recursive: true, force: true });
}
