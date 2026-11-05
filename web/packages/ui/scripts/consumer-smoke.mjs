import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, resolve, sep } from "node:path";
import { gzipSync } from "node:zlib";
import { build } from "esbuild";
import { manifest, packageRoot } from "./registry.mjs";
import { checkConsumerTheme } from "./consumer-theme.mjs";

const workspaceRequire = createRequire(resolve(packageRoot, "../../package.json"));
const packageRequire = createRequire(resolve(packageRoot, "package.json"));
const packageJson = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8"));
const temporaryRoot = realpathSync(mkdtempSync(resolve(tmpdir(), "violet-ui-consumer-")));
const consumerRoot = resolve(temporaryRoot, "consumer");
mkdirSync(consumerRoot);
const keep = process.argv.includes("--keep");

const run = (args, cwd = packageRoot) => {
	const result = spawnSync("pnpm", args, { cwd, stdio: "inherit", env: process.env });
	assert.equal(result.status, 0, `pnpm ${args.join(" ")} failed.`);
};
const installedVersion = (name) => {
	for (const require of [packageRequire, workspaceRequire]) {
		for (const specifier of [`${name}/package.json`, name]) {
			let directory;
			try {
				directory = dirname(require.resolve(specifier));
			} catch {
				continue;
			}
			for (; ;) {
				try {
					const metadata = JSON.parse(readFileSync(resolve(directory, "package.json"), "utf8"));
					if (metadata.name === name) return metadata.version;
				} catch { }
				const parent = dirname(directory);
				if (parent === directory) break;
				directory = parent;
			}
		}
	}
	throw new Error(`Cannot resolve installed version of ${name}.`);
};

try {
	run(["pack", "--pack-destination", temporaryRoot]);
	const tarball = resolve(temporaryRoot, readdirSync(temporaryRoot).find((name) => name.endsWith(".tgz")));
	const tools = ["vite", "typescript", "tailwindcss", "@tailwindcss/vite", "@types/react", "@types/react-dom", "@types/node", "esbuild"];
	const consumerPackage = {
		name: "violet-ui-independent-consumer",
		private: true,
		type: "module",
		dependencies: { "@violet/ui": `file:${tarball}`, react: installedVersion("react"), "react-dom": installedVersion("react-dom") },
		devDependencies: Object.fromEntries(tools.map((name) => [name, installedVersion(name)])),
		pnpm: { overrides: Object.fromEntries(Object.keys(packageJson.dependencies).map((name) => [name, installedVersion(name)])) },
	};
	writeFileSync(resolve(consumerRoot, "package.json"), `${JSON.stringify(consumerPackage, null, 2)}\n`);
	writeFileSync(resolve(consumerRoot, "pnpm-workspace.yaml"), "packages: []\nallowBuilds:\n  esbuild: true\n  lightningcss: true\n");
	run(["install", "--prefer-offline", "--ignore-scripts", "--no-frozen-lockfile"], consumerRoot);
	mkdirSync(resolve(consumerRoot, "src"));
	const fixtureRoot = resolve(packageRoot, "fixtures/consumer");
	for (const [fixture, destination] of [["index.html", "index.html"], ["plain.html", "plain.html"], ["main.tsx", "src/main.tsx"], ["style.css", "src/style.css"], ["ssr.tsx", "ssr.tsx"], ["type-tests.tsx", "type-tests.tsx"]]) {
		cpSync(resolve(fixtureRoot, `${fixture}.template`), resolve(consumerRoot, destination));
	}
	const compilerOptions = { target: "ES2022", module: "ESNext", moduleResolution: "Bundler", jsx: "react-jsx", strict: true, noEmit: true, skipLibCheck: false, types: ["vite/client", "node"] };
	writeFileSync(resolve(consumerRoot, "tsconfig.json"), JSON.stringify({ compilerOptions, include: ["src", "ssr.tsx", "type-tests.tsx"] }));
	writeFileSync(resolve(consumerRoot, "tsconfig.nodenext.json"), JSON.stringify({ extends: "./tsconfig.json", compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext" } }));
	writeFileSync(resolve(consumerRoot, "vite.config.mjs"), 'import { defineConfig } from "vite";\nimport tailwindcss from "@tailwindcss/vite";\nexport default defineConfig({ plugins: [tailwindcss()], build: { rolldownOptions: { input: { main: "index.html", plain: "plain.html" } } } });\n');
	const consumerRequire = createRequire(resolve(consumerRoot, "package.json"));
	const installedEntry = realpathSync(consumerRequire.resolve("@violet/ui"));
	assert.ok(installedEntry.startsWith(`${consumerRoot}${sep}`) && installedEntry.endsWith("/dist/index.js"), "Consumer resolves workspace source instead of installed dist.");
	const installedManifest = consumerRequire("@violet/ui/component-manifest.json");
	assert.deepEqual(installedManifest, manifest);
	run(["exec", "tsc", "-p", "tsconfig.json"], consumerRoot);
	run(["exec", "tsc", "-p", "tsconfig.nodenext.json"], consumerRoot);
	await build({ absWorkingDir: consumerRoot, entryPoints: ["ssr.tsx"], outfile: resolve(consumerRoot, "ssr.mjs"), bundle: true, packages: "external", platform: "node", format: "esm", jsx: "automatic", logLevel: "silent" });
	const ssr = spawnSync(process.execPath, ["ssr.mjs"], { cwd: consumerRoot, stdio: "inherit" });
	assert.equal(ssr.status, 0, "Installed tarball SSR failed.");
	const forbidden = /(?:^|\/)(?:motion|framer-motion|recharts|sonner|input-otp)(?:\/|@|$)/;
	const graphs = {};
	for (const [name, entry, symbol] of [["root-button", '@violet/ui', "Button"], ["leaf-button", '@violet/ui/button', "Button"], ["root-input", '@violet/ui', "Input"], ["leaf-input", '@violet/ui/input', "Input"], ["root-search-input", '@violet/ui', "SearchInput"], ["leaf-search-input", '@violet/ui/search-input', "SearchInput"], ["root-checkbox", '@violet/ui', "Checkbox"], ["leaf-checkbox", '@violet/ui/checkbox', "Checkbox"], ["root-image-pixel-reveal", '@violet/ui', "ImagePixelReveal"], ["leaf-image-pixel-reveal", '@violet/ui/image-pixel-reveal', "ImagePixelReveal"], ["root-upload-tile", '@violet/ui', "UploadTile"], ["leaf-upload-tile", '@violet/ui/upload-tile', "UploadTile"], ["root-dropdown", '@violet/ui', "Dropdown"], ["leaf-dropdown", '@violet/ui/dropdown', "Dropdown"], ["root-segmented", '@violet/ui', "Segmented"], ["leaf-segmented", '@violet/ui/segmented', "Segmented"], ["root-link-card", '@violet/ui', "LinkCard"], ["leaf-link-card", '@violet/ui/link-card', "LinkCard"], ["root-avatar", '@violet/ui', "Avatar"], ["leaf-avatar", '@violet/ui/avatar', "Avatar"], ["root-badge", '@violet/ui', "Badge"], ["leaf-badge", '@violet/ui/badge', "Badge"], ["root-kbd", '@violet/ui', "Kbd"], ["leaf-kbd", '@violet/ui/kbd', "Kbd"], ["root-card", '@violet/ui', "Card"], ["leaf-card", '@violet/ui/card', "Card"], ["root-separator", '@violet/ui', "Separator"], ["leaf-separator", '@violet/ui/separator', "Separator"], ["root-skeleton", '@violet/ui', "Skeleton"], ["leaf-skeleton", '@violet/ui/skeleton', "Skeleton"], ["root-switch", '@violet/ui', "Switch"], ["leaf-switch", '@violet/ui/switch', "Switch"], ["root-radio-group", '@violet/ui', "RadioGroup"], ["leaf-radio-group", '@violet/ui/radio', "RadioGroup"], ["root-toggle-group", '@violet/ui', "ToggleGroup"], ["leaf-toggle-group", '@violet/ui/toggle-group', "ToggleGroup"], ["root-tabs", '@violet/ui', "Tabs"], ["leaf-tabs", '@violet/ui/tabs', "Tabs"], ["root-popover", '@violet/ui', "Popover"], ["leaf-popover", '@violet/ui/popover', "Popover"], ["root-hover-card", '@violet/ui', "HoverCard"], ["leaf-hover-card", '@violet/ui/hover-card', "HoverCard"], ["root-tooltip", '@violet/ui', "Tooltip"], ["leaf-tooltip", '@violet/ui/tooltip', "Tooltip"], ["root-dropdown-menu", '@violet/ui', "DropdownMenu"], ["leaf-dropdown-menu", '@violet/ui/dropdown-menu', "DropdownMenu"], ["root-context-menu", '@violet/ui', "ContextMenu"], ["leaf-context-menu", '@violet/ui/context-menu', "ContextMenu"], ["variants", '@violet/ui/variants']]) {
		const code = name === "variants" ? `import { badgeVariants, buttonVariants, checkboxVariants, countVariants, inputVariants, kbdVariants, tagVariants } from "${entry}"; console.log(badgeVariants({ tone: "ok" }), buttonVariants({ variant: "primary" }), checkboxVariants({ size: "lg" }), countVariants({ variant: "inline" }), inputVariants({ variant: "outline" }), kbdVariants({ size: "sm" }), tagVariants({ size: "sm" }));` : `import { ${symbol} } from "${entry}"; console.log(${symbol});`;
		const result = await build({ absWorkingDir: consumerRoot, stdin: { contents: code, resolveDir: consumerRoot, sourcefile: `${name}.ts` }, bundle: true, treeShaking: true, minify: true, write: false, metafile: true, format: "esm", platform: "browser", logLevel: "silent" });
		const reachableInputs = Object.values(result.metafile.outputs).flatMap((output) => Object.entries(output.inputs).filter(([, info]) => info.bytesInOutput > 0).map(([path]) => path));
		const unrelatedInputs = reachableInputs.filter((path) => forbidden.test(path));
		assert.equal(unrelatedInputs.length, 0, `${name} retains unrelated component dependencies: ${unrelatedInputs.join(", ")}`);
		if (name === "variants") assert.ok(!reachableInputs.some((path) => /(?:^|\/)(?:react|react-dom)(?:\/|@|$)/.test(path)), "Pure variant consumer retains React.");
		const output = result.outputFiles[0].contents;
		graphs[name] = { bytes: output.length, gzipBytes: gzipSync(output).length, reachableInputs };
		writeFileSync(resolve(consumerRoot, `${name}.graph.json`), JSON.stringify(result.metafile, null, 2));
	}
	const toaster = await build({ absWorkingDir: consumerRoot, stdin: { contents: 'import { Toaster } from "@violet/ui/sonner"; console.log(Toaster);', resolveDir: consumerRoot, sourcefile: "toaster.ts" }, bundle: true, treeShaking: true, minify: true, write: false, metafile: true, format: "esm", platform: "browser", logLevel: "silent" });
	const toasterInputs = Object.values(toaster.metafile.outputs).flatMap((output) => Object.entries(output.inputs).filter(([, info]) => info.bytesInOutput > 0).map(([path]) => path));
	assert.ok(toasterInputs.some((path) => /(?:^|\/)sonner(?:\/|@|$)/.test(path)), "Toaster no longer reaches the sonner engine.");
	const css = {};
	const cssText = {};
	for (const [name, imports] of [["all", ["tokens.css", "classes.css"]], ["button", ["tokens.css", "components/button.css"]], ["checkbox", ["tokens.css", "components/checkbox.css"]], ["input", ["tokens.css", "components/input.css"]], ["search-input", ["tokens.css", "components/search-input.css"]], ["image-pixel-reveal", ["tokens.css", "components/image-pixel-reveal.css"]], ["upload-tile", ["tokens.css", "components/upload-tile.css"]], ["dropdown", ["tokens.css", "components/dropdown.css"]], ["segmented", ["tokens.css", "components/segmented.css"]], ["link-card", ["tokens.css", "components/link-card.css"]], ["avatar", ["tokens.css", "components/avatar.css"]], ["badge", ["tokens.css", "components/badge.css"]], ["kbd", ["tokens.css", "components/kbd.css"]], ["card", ["tokens.css", "components/card.css"]], ["separator", ["tokens.css", "components/separator.css"]], ["skeleton", ["tokens.css", "components/skeleton.css"]], ["switch", ["tokens.css", "components/switch.css"]], ["radio", ["tokens.css", "components/radio.css"]], ["toggle-group", ["tokens.css", "components/toggle-group.css"]], ["tabs", ["tokens.css", "components/tabs.css"]], ["popover", ["tokens.css", "components/popover.css"]], ["hover-card", ["tokens.css", "components/hover-card.css"]], ["tooltip", ["tokens.css", "components/tooltip.css"]], ["dropdown-menu", ["tokens.css", "components/dropdown-menu.css"]], ["context-menu", ["tokens.css", "components/context-menu.css"]], ["sonner", ["tokens.css", "components/sonner.css"]]]) {
		const result = await build({ absWorkingDir: consumerRoot, stdin: { contents: imports.map((path) => `@import "@violet/ui/${path}";`).join("\n"), resolveDir: consumerRoot, loader: "css", sourcefile: `${name}.css` }, bundle: true, minify: true, write: false, logLevel: "silent" });
		const output = result.outputFiles[0].contents;
		assert.ok(!/@(?:theme|source|utility|apply)\b/.test(result.outputFiles[0].text), "Standalone CSS requires Tailwind processing.");
		css[name] = { bytes: output.length, gzipBytes: gzipSync(output).length };
		cssText[name] = result.outputFiles[0].text;
		writeFileSync(resolve(consumerRoot, `${name}.css`), output);
	}
	assert.ok(css.button.bytes < css.all.bytes, "Per-component CSS did not reduce the style payload.");
	assert.ok(css.checkbox.bytes < css.all.bytes, "Checkbox CSS did not reduce the style payload.");
	assert.match(cssText.checkbox, /\.v-checkbox\s*\{/);
	assert.match(cssText.checkbox, /\.v-checkbox__tick\s*\{/);
	assert.ok(css.input.bytes < css.all.bytes, "Input CSS did not reduce the style payload.");
	assert.ok(css["image-pixel-reveal"].bytes < css.all.bytes, "ImagePixelReveal CSS did not reduce the style payload.");
	assert.ok(css["upload-tile"].bytes < css.all.bytes, "UploadTile CSS did not reduce the style payload.");
	assert.match(cssText["upload-tile"], /\.v-upload-tile\s*\{/);
	assert.match(cssText.all, /\.v-upload-tile\s*\{/);
	assert.ok(css.dropdown.bytes < css.all.bytes, "Dropdown CSS did not reduce the style payload.");
	assert.match(cssText.dropdown, /\.v-dropdown__content\s*\{/);
	assert.match(cssText.all, /\.v-dropdown__content\s*\{/);
	assert.ok(css.segmented.bytes < css.all.bytes, "Segmented CSS did not reduce the style payload.");
	assert.match(cssText.segmented, /\.v-segmented\s*\{/);
	assert.match(cssText.all, /\.v-segmented\s*\{/);
	assert.ok(css["link-card"].bytes < css.all.bytes, "LinkCard CSS did not reduce the style payload.");
	assert.match(cssText["link-card"], /\.v-link-card\s*\{/);
	assert.match(cssText.all, /\.v-link-card\s*\{/);
	for (const [name, ...patterns] of [["avatar", /\.v-avatar\s*\{/, /\.v-avatar-group\s*\{/], ["badge", /\.v-tag\s*\{/, /\.v-badge\s*\{/, /\.v-count\s*\{/, /\.v-badge-anchor\s*\{/], ["kbd", /\.v-kbd\s*\{/], ["card", /\.v-card\s*\{/, /\.v-card-frame\s*\{/], ["separator", /\.v-separator\s*\{/], ["skeleton", /\.v-skeleton\s*\{/], ["switch", /\.v-switch\s*\{/, /\.v-switch__thumb\s*\{/], ["radio", /\.v-radio-group\s*\{/, /\.v-radio\s*\{/, /\.v-radio__control\s*\{/], ["toggle-group", /\.v-toggle-group\s*\{/, /\.v-toggle-group__item\s*\{/], ["tabs", /\.v-tabs__list\s*\{/, /\.v-tabs__tab\s*\{/, /\.v-tabs__indicator\s*\{/, /\.v-tabs__panel\s*\{/]]) {
		assert.ok(css[name].bytes < css.all.bytes, `${name} CSS did not reduce the style payload.`);
		for (const pattern of patterns) {
			assert.match(cssText[name], pattern, `${name} leaf CSS lacks ${pattern}.`);
			assert.match(cssText.all, pattern, `Aggregated CSS lacks ${pattern}.`);
		}
	}
	for (const [name, ...patterns] of [["popover", /\.v-popover\s*[,{]/], ["hover-card", /\.v-hover-card\s*[,{]/], ["tooltip", /\.v-tooltip\s*[,{]/, /\.v-tooltip__arrow\s*[,{]/, /\.v-kbd\s*[,{]/], ["dropdown-menu", /\.v-dropdown-menu__content\s*[,{]/, /\.v-dropdown-menu__item\s*[,{]/], ["context-menu", /\.v-context-menu__content\s*[,{]/, /\.v-dropdown-menu__item\s*[,{]/], ["sonner", /\.v-toaster\s*[,{]/, /\.v-toast\s*[,{]/, /\.v-toast__action\s*[,{]/, /\.v-spinner\s*[,{]/]]) {
		assert.ok(css[name].bytes < css.all.bytes, `${name} CSS did not reduce the style payload.`);
		for (const pattern of patterns) {
			assert.match(cssText[name], pattern, `${name} leaf CSS lacks ${pattern}.`);
			assert.match(cssText.all, pattern, `Aggregated CSS lacks ${pattern}.`);
		}
		if (name !== "sonner") assert.match(cssText[name], /@keyframes v-float-in\b/, `${name} leaf CSS lacks the shared float motion.`);
	}
	const themeCss = await build({
		absWorkingDir: consumerRoot,
		stdin: { contents: '@import "@violet/ui/palettes/coral.css";\n@import "@violet/ui/tokens.css";\n@import "@violet/ui/classes.css";', resolveDir: consumerRoot, loader: "css" },
		bundle: true,
		write: false,
		logLevel: "silent",
	});
	await checkConsumerTheme(themeCss.outputFiles[0].text, readFileSync(resolve(consumerRoot, "plain.html"), "utf8"));
	run(["exec", "vite", "build"], consumerRoot);
	writeFileSync(resolve(consumerRoot, "bundle-report.json"), JSON.stringify({ installedEntry, graphs, css }, null, 2));
	console.log(JSON.stringify({ consumerRoot, installedEntry, js: Object.fromEntries(Object.entries(graphs).map(([name, value]) => [name, { bytes: value.bytes, gzipBytes: value.gzipBytes }])), css }, null, 2));
	if (keep) {
		console.log(`Consumer retained for browser QA: ${consumerRoot}`);
		console.log("Run pnpm exec vite --host 127.0.0.1 from that directory; open /?preview=input for focus, clear, password, native forms and theme QA, /?preview=image-pixel-reveal for image QA, /?preview=upload-tile for click, keyboard, busy/disabled, theme and narrow-layout QA, /?preview=dropdown for hover, keyboard focus, Escape, touch, theme and narrow-layout QA, /?preview=segmented for indicator glide, keyboard focus, expandSelected, theme and narrow-layout QA, /?preview=link-card for native navigation, image fallback/recovery, theme and narrow-layout QA, or /?preview=display for avatar load/failure, count and tag interaction, keycap platform, card link coverage, theme and narrow-layout QA.");
	}
} finally {
	if (!keep) rmSync(temporaryRoot, { recursive: true, force: true });
}
