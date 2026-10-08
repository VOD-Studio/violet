import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, resolve, sep } from "node:path";
import { gzipSync } from "node:zlib";
import { build } from "esbuild";
import { manifest, packageRoot } from "./registry.mjs";

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
	for (const [name, entry, symbol] of [["root-button", '@violet/ui', "Button"], ["leaf-button", '@violet/ui/button', "Button"], ["root-checkbox", '@violet/ui', "Checkbox"], ["leaf-checkbox", '@violet/ui/checkbox', "Checkbox"], ["root-image-pixel-reveal", '@violet/ui', "ImagePixelReveal"], ["leaf-image-pixel-reveal", '@violet/ui/image-pixel-reveal', "ImagePixelReveal"], ["root-upload-tile", '@violet/ui', "UploadTile"], ["leaf-upload-tile", '@violet/ui/upload-tile', "UploadTile"], ["root-dropdown", '@violet/ui', "Dropdown"], ["leaf-dropdown", '@violet/ui/dropdown', "Dropdown"], ["root-segmented", '@violet/ui', "Segmented"], ["leaf-segmented", '@violet/ui/segmented', "Segmented"], ["variants", '@violet/ui/variants']]) {
		const code = name === "variants" ? `import { buttonVariants, checkboxVariants } from "${entry}"; console.log(buttonVariants({ variant: "primary" }), checkboxVariants({ size: "lg" }));` : `import { ${symbol} } from "${entry}"; console.log(${symbol});`;
		const result = await build({ absWorkingDir: consumerRoot, stdin: { contents: code, resolveDir: consumerRoot, sourcefile: `${name}.ts` }, bundle: true, treeShaking: true, minify: true, write: false, metafile: true, format: "esm", platform: "browser", logLevel: "silent" });
		const reachableInputs = Object.values(result.metafile.outputs).flatMap((output) => Object.entries(output.inputs).filter(([, info]) => info.bytesInOutput > 0).map(([path]) => path));
		const unrelatedInputs = reachableInputs.filter((path) => forbidden.test(path));
		assert.equal(unrelatedInputs.length, 0, `${name} retains unrelated component dependencies: ${unrelatedInputs.join(", ")}`);
		if (name === "variants") assert.ok(!reachableInputs.some((path) => /(?:^|\/)(?:react|react-dom)(?:\/|@|$)/.test(path)), "Pure variant consumer retains React.");
		const output = result.outputFiles[0].contents;
		graphs[name] = { bytes: output.length, gzipBytes: gzipSync(output).length, reachableInputs };
		writeFileSync(resolve(consumerRoot, `${name}.graph.json`), JSON.stringify(result.metafile, null, 2));
	}
	const css = {};
	const cssText = {};
	for (const [name, imports] of [["all", ["tokens.css", "classes.css"]], ["button", ["tokens.css", "components/button.css"]], ["checkbox", ["tokens.css", "components/checkbox.css"]], ["text-field", ["tokens.css", "components/text-field.css"]], ["image-pixel-reveal", ["tokens.css", "components/image-pixel-reveal.css"]], ["upload-tile", ["tokens.css", "components/upload-tile.css"]], ["dropdown", ["tokens.css", "components/dropdown.css"]], ["segmented", ["tokens.css", "components/segmented.css"]]]) {
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
	assert.match(cssText.checkbox, /\.v-checkbox__indicator\s*\{/);
	assert.ok(css["text-field"].bytes < css.all.bytes, "TextField CSS did not reduce the style payload.");
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
	for (const className of ["v-input", "v-label", "v-text-field"]) {
		const selector = new RegExp(`(?:^|[{};])\\s*\\.${className}\\s*\\{`, "g");
		const componentRules = Array.from(cssText["text-field"].matchAll(selector)).length;
		assert.ok(componentRules > 0, `TextField CSS omits ${className}.`);
		assert.equal(Array.from(cssText.all.matchAll(selector)).length, componentRules, `Aggregate CSS duplicates ${className} rules.`);
	}
	run(["exec", "vite", "build"], consumerRoot);
	writeFileSync(resolve(consumerRoot, "bundle-report.json"), JSON.stringify({ installedEntry, graphs, css }, null, 2));
	console.log(JSON.stringify({ consumerRoot, installedEntry, js: Object.fromEntries(Object.entries(graphs).map(([name, value]) => [name, { bytes: value.bytes, gzipBytes: value.gzipBytes }])), css }, null, 2));
	if (keep) {
		console.log(`Consumer retained for browser QA: ${consumerRoot}`);
		console.log("Run pnpm exec vite --host 127.0.0.1 from that directory; open /?preview=image-pixel-reveal for image QA, /?preview=upload-tile for click, keyboard, busy/disabled, theme and narrow-layout QA, /?preview=dropdown for hover, keyboard focus, Escape, touch, theme and narrow-layout QA, or /?preview=segmented for indicator glide, keyboard focus, expandSelected, theme and narrow-layout QA.");
	}
} finally {
	if (!keep) rmSync(temporaryRoot, { recursive: true, force: true });
}
