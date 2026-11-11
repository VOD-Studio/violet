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
	for (const [fixture, destination] of [
 ["index.html", "index.html"],
	["reaction.tsx", "src/reaction.tsx"],
	["reaction-ssr.tsx", "reaction-ssr.tsx"],
 ["emoji-picker.tsx", "src/emoji-picker.tsx"], ["emoji-picker-ssr.tsx", "emoji-picker-ssr.tsx"], ["sortable.tsx", "src/sortable.tsx"], ["sortable-ssr.tsx", "sortable-ssr.tsx"], ["upload.tsx", "src/upload.tsx"], ["upload-types.tsx", "upload-types.tsx"], ["upload-ssr.tsx", "upload-ssr.tsx"], ["plain.html", "plain.html"], ["main.tsx", "src/main.tsx"], ["value-controls.tsx", "src/value-controls.tsx"], ["value-controls-types.tsx", "value-controls-types.tsx"], ["value-controls-ssr.tsx", "value-controls-ssr.tsx"], ["data-display.tsx", "src/data-display.tsx"], ["data-display-types.tsx", "data-display-types.tsx"], ["data-display-ssr.tsx", "data-display-ssr.tsx"], ["style.css", "src/style.css"], ["ssr.tsx", "ssr.tsx"], ["type-tests.tsx", "type-tests.tsx"], ["../../src/components/annotation/fixtures/consumer.tsx", "src/annotation.tsx"], ["../../src/components/mention/fixtures/consumer.tsx", "src/mention.tsx"], ["quote-card.tsx", "src/quote-card.tsx"], ["quote-card-ssr.tsx", "quote-card-ssr.tsx"], ["quote-card-types.tsx", "quote-card-types.tsx"], ["image-grid.tsx", "src/image-grid.tsx"], ["content-ssr.tsx", "content-ssr.tsx"]
]) {
 cpSync(resolve(fixtureRoot, `${fixture}.template`), resolve(consumerRoot, destination));
}
	const compilerOptions = { target: "ES2022", module: "ESNext", moduleResolution: "Bundler", jsx: "react-jsx", strict: true, noEmit: true, skipLibCheck: false, types: ["vite/client", "node"] };
	writeFileSync(resolve(consumerRoot, "tsconfig.json"), JSON.stringify({ compilerOptions, include: ["src", "ssr.tsx", "type-tests.tsx", "data-display-types.tsx", "data-display-ssr.tsx", "quote-card-types.tsx", "quote-card-ssr.tsx"] }));
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
	for (const [name, entry, symbol] of [
		["root-reaction", "@violet/ui", "ReactionBar"],
		["leaf-reaction", "@violet/ui/reaction", "ReactionBar"],
 ["root-upload-queue", "@violet/ui", "UploadQueue"],
 ["root-emoji-picker", "@violet/ui", "EmojiPickerPanel"], ["leaf-emoji-picker", "@violet/ui/emoji-picker", "EmojiPickerPanel"], ["root-sortable", "@violet/ui", "Sortable"], ["leaf-sortable", "@violet/ui/sortable", "Sortable"], ["leaf-upload-queue", "@violet/ui/upload", "UploadQueue"], ["root-upload-dropzone", "@violet/ui", "UploadDropzone"], ["leaf-upload-dropzone", "@violet/ui/upload", "UploadDropzone"], ["root-button", '@violet/ui', "Button"], ["leaf-button", '@violet/ui/button', "Button"], ["root-input", '@violet/ui', "Input"], ["leaf-input", '@violet/ui/input', "Input"], ["root-select", '@violet/ui', "Select"], ["leaf-select", '@violet/ui/select', "Select"], ["root-combobox", '@violet/ui', "Combobox"], ["leaf-combobox", '@violet/ui/combobox', "Combobox"], ["root-tag-input", '@violet/ui', "TagInput"], ["leaf-tag-input", '@violet/ui/tag-input', "TagInput"], ["root-cascader", '@violet/ui', "Cascader"], ["leaf-cascader", '@violet/ui/cascader', "Cascader"], ["root-tree-select", '@violet/ui', "TreeSelect"], ["leaf-tree-select", '@violet/ui/tree-select', "TreeSelect"], ["root-search-input", '@violet/ui', "SearchInput"], ["leaf-search-input", '@violet/ui/input', "SearchInput"], ["root-field", '@violet/ui', "Field"], ["leaf-field", '@violet/ui/field', "Field"], ["root-checkbox", '@violet/ui', "Checkbox"], ["leaf-checkbox", '@violet/ui/checkbox', "Checkbox"], ["root-image-pixel-reveal", '@violet/ui', "ImagePixelReveal"], ["leaf-image-pixel-reveal", '@violet/ui/image-pixel-reveal', "ImagePixelReveal"], ["root-upload-tile", '@violet/ui', "UploadTile"], ["leaf-upload-tile", '@violet/ui/upload-tile', "UploadTile"], ["root-dropdown", '@violet/ui', "Dropdown"], ["leaf-dropdown", '@violet/ui/dropdown', "Dropdown"], ["root-segmented", '@violet/ui', "Segmented"], ["leaf-segmented", '@violet/ui/segmented', "Segmented"], ["root-link-card", '@violet/ui', "LinkCard"], ["leaf-link-card", '@violet/ui/link-card', "LinkCard"], ["root-avatar", '@violet/ui', "Avatar"], ["leaf-avatar", '@violet/ui/avatar', "Avatar"], ["root-badge", '@violet/ui', "Badge"], ["leaf-badge", '@violet/ui/badge', "Badge"], ["root-kbd", '@violet/ui', "Kbd"], ["leaf-kbd", '@violet/ui/kbd', "Kbd"], ["root-card", '@violet/ui', "Card"], ["leaf-card", '@violet/ui/card', "Card"], ["root-separator", '@violet/ui', "Separator"], ["leaf-separator", '@violet/ui/separator', "Separator"], ["root-skeleton", '@violet/ui', "Skeleton"], ["leaf-skeleton", '@violet/ui/skeleton', "Skeleton"], ["root-switch", '@violet/ui', "Switch"], ["leaf-switch", '@violet/ui/switch', "Switch"], ["root-radio-group", '@violet/ui', "RadioGroup"], ["leaf-radio-group", '@violet/ui/radio', "RadioGroup"], ["root-toggle-group", '@violet/ui', "ToggleGroup"], ["leaf-toggle-group", '@violet/ui/toggle-group', "ToggleGroup"], ["root-tabs", '@violet/ui', "Tabs"], ["leaf-tabs", '@violet/ui/tabs', "Tabs"], ["root-popover", '@violet/ui', "Popover"], ["leaf-popover", '@violet/ui/popover', "Popover"], ["root-hover-card", '@violet/ui', "HoverCard"], ["leaf-hover-card", '@violet/ui/hover-card', "HoverCard"], ["root-tooltip", '@violet/ui', "Tooltip"], ["leaf-tooltip", '@violet/ui/tooltip', "Tooltip"], ["root-dropdown-menu", '@violet/ui', "DropdownMenu"], ["leaf-dropdown-menu", '@violet/ui/dropdown-menu', "DropdownMenu"], ["root-context-menu", '@violet/ui', "ContextMenu"], ["leaf-context-menu", '@violet/ui/context-menu', "ContextMenu"], ["root-dialog", '@violet/ui', "Dialog"], ["leaf-dialog", '@violet/ui/dialog', "Dialog"], ["root-modal", '@violet/ui', "Modal"], ["leaf-modal", '@violet/ui/dialog', "Modal"], ["root-confirm-dialog", '@violet/ui', "ConfirmDialog"], ["leaf-confirm-dialog", '@violet/ui/confirm-dialog', "ConfirmDialog"], ["root-prompt-dialog", '@violet/ui', "PromptDialog"], ["leaf-prompt-dialog", '@violet/ui/prompt-dialog', "PromptDialog"], ["root-sheet", '@violet/ui', "Sheet"], ["leaf-sheet", '@violet/ui/sheet', "Sheet"], ["root-drawer", '@violet/ui', "Drawer"], ["leaf-drawer", '@violet/ui/drawer', "Drawer"], ["root-command", '@violet/ui', "CommandList"], ["leaf-command", '@violet/ui/command', "CommandList"], ["root-morphing-popover", '@violet/ui', "MorphingPopover"], ["leaf-morphing-popover", '@violet/ui/morphing-popover', "MorphingPopover"], ["variants", '@violet/ui/variants'], ["root-date-picker", "@violet/ui", "DatePicker"], ["leaf-date-picker", "@violet/ui/date-picker", "DatePicker"], ["root-number-input", "@violet/ui", "NumberInput"], ["leaf-number-input", "@violet/ui/number-input", "NumberInput"], ["root-slider", "@violet/ui", "Slider"], ["leaf-slider", "@violet/ui/slider", "Slider"], ["root-color-picker", "@violet/ui", "HsvColorPicker"], ["leaf-color-picker", "@violet/ui/color-picker", "HsvColorPicker"], ["root-otp", "@violet/ui", "InputOTP"], ["leaf-otp", "@violet/ui/otp", "InputOTP"], ["root-resend-button", "@violet/ui", "ResendButton"], ["leaf-resend-button", "@violet/ui/resend-button", "ResendButton"], ["root-accordion", "@violet/ui", "Accordion"], ["leaf-accordion", "@violet/ui/accordion", "Accordion"], ["root-list", "@violet/ui", "List"], ["leaf-list", "@violet/ui/list", "List"], ["root-tree", "@violet/ui", "Tree"], ["leaf-tree", "@violet/ui/tree", "Tree"], ["root-pagination", "@violet/ui", "Pagination"], ["leaf-pagination", "@violet/ui/pagination", "Pagination"], ["root-data-table", "@violet/ui", "DataTable"], ["leaf-data-table", "@violet/ui/table", "DataTable"], ["root-annotation", "@violet/ui", "AnnotationMark"], ["leaf-annotation", "@violet/ui/annotation", "AnnotationMark"], ["root-mention", "@violet/ui", "MentionList"], ["leaf-mention", "@violet/ui/mention", "MentionList"], ["root-quote-card", "@violet/ui", "QuoteCard"], ["leaf-quote-card", "@violet/ui/quote-card", "QuoteCard"], ["root-image-grid", "@violet/ui", "ImageGrid"], ["leaf-image-grid", "@violet/ui/image-grid", "ImageGrid"]
]) {
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
	for (const [name, imports] of [
		["reaction", ["tokens.css", "components/reaction.css"]],
 ["alert", ["tokens.css", "components/alert.css"]],
 ["emoji-picker", ["tokens.css", "components/emoji-picker.css"]], ["sortable", ["tokens.css", "components/sortable.css"]], ["breadcrumbs", ["tokens.css", "components/breadcrumbs.css"]], ["chart", ["tokens.css", "components/chart.css"]], ["empty", ["tokens.css", "components/empty.css"]], ["page-header", ["tokens.css", "components/page-header.css"]], ["progress", ["tokens.css", "components/progress.css"]], ["steps", ["tokens.css", "components/steps.css"]], ["upload", ["tokens.css", "components/upload.css"]], ["all", ["tokens.css", "classes.css"]], ["button", ["tokens.css", "components/button.css"]], ["checkbox", ["tokens.css", "components/checkbox.css"]], ["input", ["tokens.css", "components/input.css"]], ["select", ["tokens.css", "components/select.css"]], ["combobox", ["tokens.css", "components/combobox.css"]], ["tag-input", ["tokens.css", "components/tag-input.css"]], ["cascader", ["tokens.css", "components/cascader.css"]], ["tree-select", ["tokens.css", "components/tree-select.css"]], ["field", ["tokens.css", "components/field.css"]], ["image-pixel-reveal", ["tokens.css", "components/image-pixel-reveal.css"]], ["upload-tile", ["tokens.css", "components/upload-tile.css"]], ["dropdown", ["tokens.css", "components/dropdown.css"]], ["segmented", ["tokens.css", "components/segmented.css"]], ["link-card", ["tokens.css", "components/link-card.css"]], ["avatar", ["tokens.css", "components/avatar.css"]], ["badge", ["tokens.css", "components/badge.css"]], ["kbd", ["tokens.css", "components/kbd.css"]], ["card", ["tokens.css", "components/card.css"]], ["separator", ["tokens.css", "components/separator.css"]], ["skeleton", ["tokens.css", "components/skeleton.css"]], ["switch", ["tokens.css", "components/switch.css"]], ["radio", ["tokens.css", "components/radio.css"]], ["toggle-group", ["tokens.css", "components/toggle-group.css"]], ["tabs", ["tokens.css", "components/tabs.css"]], ["popover", ["tokens.css", "components/popover.css"]], ["hover-card", ["tokens.css", "components/hover-card.css"]], ["tooltip", ["tokens.css", "components/tooltip.css"]], ["dropdown-menu", ["tokens.css", "components/dropdown-menu.css"]], ["context-menu", ["tokens.css", "components/context-menu.css"]], ["sonner", ["tokens.css", "components/sonner.css"]], ["dialog", ["tokens.css", "components/dialog.css"]], ["confirm-dialog", ["tokens.css", "components/confirm-dialog.css"]], ["prompt-dialog", ["tokens.css", "components/prompt-dialog.css"]], ["sheet", ["tokens.css", "components/sheet.css"]], ["drawer", ["tokens.css", "components/drawer.css"]], ["command", ["tokens.css", "components/command.css"]], ["morphing-popover", ["tokens.css", "components/morphing-popover.css"]], ["date-picker", ["tokens.css", "components/date-picker.css"]], ["number-input", ["tokens.css", "components/number-input.css"]], ["slider", ["tokens.css", "components/slider.css"]], ["color-picker", ["tokens.css", "components/color-picker.css"]], ["otp", ["tokens.css", "components/otp.css"]], ["resend-button", ["tokens.css", "components/resend-button.css"]], ["accordion", ["tokens.css", "components/accordion.css"]], ["list", ["tokens.css", "components/list.css"]], ["tree", ["tokens.css", "components/tree.css"]], ["pagination", ["tokens.css", "components/pagination.css"]], ["table", ["tokens.css", "components/table.css"]], ["annotation", ["tokens.css", "components/annotation.css"]], ["mention", ["tokens.css", "components/mention.css"]], ["quote-card", ["tokens.css", "components/quote-card.css"]], ["image-grid", ["tokens.css", "components/image-grid.css"]]
]) {
		const result = await build({ absWorkingDir: consumerRoot, stdin: { contents: imports.map((path) => `@import "@violet/ui/${path}";`).join("\n"), resolveDir: consumerRoot, loader: "css", sourcefile: `${name}.css` }, bundle: true, minify: true, write: false, logLevel: "silent" });
		const output = result.outputFiles[0].contents;
		assert.ok(!/@(?:theme|source|utility|apply)\b/.test(result.outputFiles[0].text), "Standalone CSS requires Tailwind processing.");
		css[name] = { bytes: output.length, gzipBytes: gzipSync(output).length };
		cssText[name] = result.outputFiles[0].text;
		writeFileSync(resolve(consumerRoot, `${name}.css`), output);
	}
	assert.ok(css.button.bytes < css.all.bytes, "Per-component CSS did not reduce the style payload.");
	assert.match(cssText.button, /\.v-button--primary\s*\{/);
	assert.match(cssText.button, /\.v-button__overlay\s*\{/);
	assert.match(cssText.all, /\.v-button--link\s*\{/);
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
	for (const [name, ...patterns] of [
		["reaction", /\.v-reaction\s*[,{]/, /\.v-morph\s*[,{]/, /\.v-list-highlight\s*[,{]/, /\.v-tooltip\s*[,{]/],
 ["alert", /\.v-alert\s*\{/, /\.v-alert__icon\s*\{/],
 ["breadcrumbs", /\.v-breadcrumbs\s*\{/, /\.v-breadcrumbs__more\s*\{/, /\.v-dropdown-menu__content\s*\{/], ["chart", /\.v-chart\s*\{/, /\.v-stat__value\s*\{/, /\.v-mini-bars__bar\s*\{/], ["empty", /\.v-empty\s*\{/, /\.v-empty__description\s*\{/], ["page-header", /\.v-page-header\s*\{/, /\.v-page-header\[data-compact\]\s*\{/], ["progress", /\.v-progress\s*\{/, /\.v-progress-ring__fill\s*\{/], ["steps", /\.v-steps\s*\{/, /\.v-steps__dot\s*\{/]
]) {
		assert.ok(css[name].bytes < css.all.bytes, `${name} CSS did not reduce the style payload.`);
		for (const pattern of patterns) {
			assert.match(cssText[name], pattern, `${name} leaf CSS lacks ${pattern}.`);
			assert.match(cssText.all, pattern, `Aggregated CSS lacks ${pattern}.`);
		}
	}
	for (const [name, ...patterns] of [["field", /\.v-field\s*\{/, /\.v-label\s*\{/, /\.v-field-summary\s*\{/], ["avatar", /\.v-avatar\s*\{/, /\.v-avatar-group\s*\{/], ["badge", /\.v-tag\s*\{/, /\.v-badge\s*\{/, /\.v-count\s*\{/, /\.v-badge-anchor\s*\{/], ["kbd", /\.v-kbd\s*\{/], ["card", /\.v-card\s*\{/, /\.v-card-frame\s*\{/], ["separator", /\.v-separator\s*\{/], ["skeleton", /\.v-skeleton\s*\{/], ["switch", /\.v-switch\s*\{/, /\.v-switch__thumb\s*\{/], ["combobox", /\.v-combobox__input[^{]*\{/, /\.v-picker-panel\s*\{/, /\.v-picker-option\s*\{/, /\.v-input-control\s*\{/], ["tag-input", /\.v-tag-input[^{_]*\{/, /\.v-tag-input__chip[^{]*\{/, /\.v-tag-input__remove[^{]*\{/, /\.v-picker-panel\s*\{/], ["cascader", /\.v-cascader-trigger[^{]*\{/, /\.v-cascader-col[^{]*\{/, /\.v-cascader-row[^{]*\{/, /\.v-picker-panel\s*\{/], ["tree-select", /\.v-tree-select__row[^{]*\{/, /\.v-tree-select__chevron[^{]*\{/, /\.v-tree-select__chip[^{]*\{/, /\.v-picker-panel\s*\{/], ["select", /\.v-select-trigger[^{]*\{/, /\.v-select-chip\s*\{/, /\.v-picker-panel\s*\{/, /\.v-picker-option\s*\{/, /\.v-input-control\s*\{/], ["radio", /\.v-radio-group\s*\{/, /\.v-radio\s*\{/, /\.v-radio__control\s*\{/], ["toggle-group", /\.v-toggle-group\s*\{/, /\.v-toggle-group__item\s*\{/], ["tabs", /\.v-tabs__list\s*\{/, /\.v-tabs__tab\s*\{/, /\.v-tabs__indicator\s*\{/, /\.v-tabs__panel\s*\{/]]) {
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
	for (const [name, ...patterns] of [["dialog", /\.v-dialog\s*[,{]/, /\.v-dialog__body\s*[,{]/, /\.v-button\s*[,{]/], ["confirm-dialog", /\.v-confirm\s*[,{]/, /\.v-confirm__error\s*[,{]/, /\.v-input-control\s*[,{]/], ["prompt-dialog", /\.v-confirm\s*[,{]/, /\.v-prompt__field\s*[,{]/, /\.v-textarea\s*[,{]/], ["sheet", /\.v-sheet\s*[,{]/, /\.v-sheet__body\s*[,{]/], ["drawer", /\.v-drawer\s*[,{]/, /\.v-drawer__handle\s*[,{]/], ["command", /\.v-command\s*[,{]/, /\.v-command__item\s*[,{]/, /\.v-spinner\s*[,{]/, /\.v-kbd\s*[,{]/, /\.v-skeleton\s*[,{]/]]) {
		assert.ok(css[name].bytes < css.all.bytes, `${name} CSS did not reduce the style payload.`);
		for (const pattern of patterns) {
			assert.match(cssText[name], pattern, `${name} leaf CSS lacks ${pattern}.`);
			assert.match(cssText.all, pattern, `Aggregated CSS lacks ${pattern}.`);
		}
		assert.match(cssText[name], /\.v-scrim\b/, `${name} leaf CSS lacks the shared scrim.`);
	}
	for (const [name, ...patterns] of [["morphing-popover", /\.v-morph\s*[,{]/, /\.v-morph__layer\s*[,{]/, /\.v-morph__ghost\s*[,{]/]]) {
		assert.ok(css[name].bytes < css.all.bytes, `${name} CSS did not reduce the style payload.`);
		for (const pattern of patterns) {
			assert.match(cssText[name], pattern, `${name} leaf CSS lacks ${pattern}.`);
			assert.match(cssText.all, pattern, `Aggregated CSS lacks ${pattern}.`);
		}
		assert.doesNotMatch(cssText[name], /\.v-scrim\b/, `${name} is non-modal and must not carry the modal scrim.`);
	}
	assert.match(cssText.upload, /\.v-upload-queue\b/);
	assert.match(cssText.upload, /\.v-upload-dropzone\b/);
	assert.match(cssText.upload, /\.v-flower\b/);
	assert.match(cssText.all, /\.v-upload-queue\b/);
	for (const [name, pattern] of [
		["date-picker", /\.v-date-picker__input\s*\{/],
		["number-input", /\.v-number-input__input\s*\{/],
		["slider", /\.v-slider\s*\{/],
		["color-picker", /\.v-color-picker\s*\{/],
		["otp", /\.v-otp\s*\{/],
		["resend-button", /\.v-resend-button[.\s{]/],
		["accordion", /\.v-accordion__item\s*[,{]/],
		["list", /\.v-list__row\s*[,{]/, /\.v-list-highlight\s*[,{]/],
		["tree", /\.v-tree__row\s*[,{]/, /\.v-list-highlight\s*[,{]/],
		["pagination", /\.v-pagination__page\s*[,{]/],
		["sortable", /\.v-sortable\s*\{/],
		["emoji-picker", /\.v-emoji-picker\s*[,{]/],
		["table", /\.v-data-table\s*[,{]/, /\.v-table__row\s*[,{]/, /\.v-pagination__page\s*[,{]/, /\.v-checkbox\s*[,{]/],
	]) {
		assert.ok(css[name].bytes < css.all.bytes, `${name} CSS did not reduce the style payload.`);
		assert.match(cssText[name], pattern, `${name} leaf CSS lacks its control styles.`);
		assert.match(cssText.all, pattern, `Aggregated CSS lacks ${name}.`);
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
