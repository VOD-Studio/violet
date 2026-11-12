import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { parse } from "@babel/parser";
import { build } from "esbuild";
import { distEntry, manifest, packageRoot, publicEntries, repositoryRoot, sourceRoot, validateManifest } from "./registry.mjs";

validateManifest();
const filesUnder = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
	const path = resolve(dir, item.name);
	return item.isDirectory() ? filesUnder(path) : [path];
});
const sourceFiles = filesUnder(sourceRoot).filter((path) => /\.[jt]sx?$/.test(path) && !/\.(test|spec)\./.test(path));

for (const component of [...manifest.components, ...manifest.additionalExports]) {
	for (const entry of [component.entry, component.css].filter(Boolean)) {
		assert.ok(existsSync(resolve(packageRoot, entry)), `Missing ${component.name} source: ${entry}`);
	}
	if (component.documentation) {
		assert.ok(existsSync(resolve(repositoryRoot, component.documentation)), `Missing ${component.name} documentation.`);
	}
}
const registered = new Set(manifest.components.map((component) => component.name));
for (const item of readdirSync(resolve(sourceRoot, "components"), { withFileTypes: true })) {
	if (item.isDirectory()) assert.ok(registered.has(item.name), `Unregistered component directory: ${item.name}`);
}
for (const item of readdirSync(sourceRoot, { withFileTypes: true })) {
	assert.ok(!item.isDirectory() || !existsSync(resolve(sourceRoot, item.name, "index.ts")), `Component implementation remains at src/${item.name}.`);
}

const visualUtilities = /(?:^|\s)(?:bg-|text-(?:sm|xs|base|lg|xl|foreground|muted|primary)|p[xytrblse]?-\d|m[xytrblse]?-\d|gap-\d|rounded-|shadow-|ring-|border-(?:border|primary)|h-\d|w-\d|flex(?:\s|$)|inline-flex|grid(?:\s|$))/;

function containsVisualUtilities(path, source) {
	const plugins = ["typescript"];
	if (path.endsWith("x")) {
		plugins.push("jsx");
	}
	const parsed = parse(source, { sourceType: "unambiguous", plugins });
	function visit(node) {
		if (!node?.type || node.type === "TSLiteralType") {
			return false;
		}
		// 数据取值与 ARIA 属性不是类名，不能把 role="grid" 误识别为视觉工具类。
		if (node.type === "JSXAttribute" && /^(?:role$|aria-)/.test(node.name.name ?? "")) {
			return false;
		}
		if (
			node.type === "ObjectProperty" &&
			(node.key.name ?? node.key.value) === "value" &&
			node.value.type === "StringLiteral"
		) {
			return false;
		}
		if (node.type === "StringLiteral") {
			return visualUtilities.test(node.value);
		}
		if (node.type === "TemplateElement") {
			return visualUtilities.test(node.value.cooked ?? node.value.raw);
		}
		for (const child of Object.values(node)) {
			if (Array.isArray(child)) {
				if (child.some((item) => item?.type && visit(item))) {
					return true;
				}
			} else if (child?.type && visit(child)) {
				return true;
			}
		}
		return false;
	}
	return visit(parsed);
}
for (const component of manifest.components.filter((item) => item.status === "foundation")) {
	const directory = resolve(packageRoot, component.entry, "..");
	for (const path of filesUnder(directory).filter((file) => /\.[jt]sx?$/.test(file) && !/\.(test|spec)\./.test(file))) {
		const source = readFileSync(path, "utf8");
		assert.ok(!containsVisualUtilities(path, source), `Foundation JSX contains visual utility classes: ${path}`);
	}
}
for (const path of sourceFiles) {
	const code = readFileSync(path, "utf8");
	assert.ok(!/(?:from\s+|import\s*)["'](?:@\/|@app\/|@features\/|@entities\/|@widgets\/|@shared\/)/.test(code), `UI depends on site code: ${path}`);
	for (const match of code.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/g)) {
		if (match[1].startsWith(".")) {
			const target = resolve(path, "..", match[1]);
			const relativeTarget = relative(sourceRoot, target);
			assert.ok(relativeTarget !== ".." && !relativeTarget.startsWith("../") && !isAbsolute(relativeTarget), `UI imports outside its source boundary: ${path}`);
		}
	}
}

if (process.argv.includes("--dist")) {
	const packageJson = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8"));
	const checkTargets = (value) => {
		if (typeof value === "string") assert.ok(existsSync(resolve(packageRoot, value)), `Missing exported target: ${value}`);
		else for (const item of Object.values(value)) checkTargets(item);
	};
	checkTargets(packageJson.publishConfig.exports);
	for (const path of sourceFiles) {
		if (/^\s*["']use client["'];/.test(readFileSync(path, "utf8"))) {
			const distPath = resolve(packageRoot, distEntry(path.slice(packageRoot.length + 1)));
			assert.ok(existsSync(distPath) && /^\s*["']use client["'];/.test(readFileSync(distPath, "utf8")), `Client directive lost: ${path}`);
		}
	}
	for (const path of filesUnder(resolve(packageRoot, "dist"))) {
		assert.ok(!/\.(test|spec)\.|__tests__|\/tests\//.test(path), `Test artifact was published: ${path}`);
	}
	for (const name of ["tokens", "classes"]) {
		assert.ok(!/@(?:theme|source|utility|apply)\b/.test(readFileSync(resolve(packageRoot, `dist/${name}.css`), "utf8")), `${name}.css contains Tailwind directives.`);
	}
	const result = await build({ entryPoints: [resolve(packageRoot, "dist/variants.js")], bundle: true, packages: "external", write: false, metafile: true, format: "esm", logLevel: "silent" });
	assert.ok(!Object.values(result.metafile.outputs).flatMap((output) => output.imports).some(({ path }) => /^(?:react|react-dom)(?:\/|$)/.test(path)), "Variants depend on React.");
	assert.ok(publicEntries.length > manifest.components.length);
}
console.log(`UI architecture valid: ${manifest.components.filter((item) => item.status === "foundation").length} foundation, ${manifest.components.filter((item) => item.status === "legacy").length} legacy components${process.argv.includes("--dist") ? "; all published targets exist" : ""}.`);
