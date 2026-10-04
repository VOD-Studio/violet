import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { packageRoot } from "./registry.mjs";

const visit = (directory) => {
	for (const item of readdirSync(directory, { withFileTypes: true })) {
		const path = resolve(directory, item.name);
		if (item.isDirectory()) visit(path);
		else if (path.endsWith(".d.ts")) {
			const code = readFileSync(path, "utf8");
			const next = code.replace(/((?:from\s+|import\s*\(\s*)["'])(\.[^"']+)(["'])/g, (match, before, specifier, after) => {
				if (/\.[cm]?js$/.test(specifier)) return match;
				const target = resolve(dirname(path), specifier);
				if (existsSync(`${target}.d.ts`)) return `${before}${specifier}.js${after}`;
				if (existsSync(resolve(target, "index.d.ts"))) return `${before}${specifier}/index.js${after}`;
				assert.fail(`Unresolvable declaration import in ${path}: ${specifier}`);
			});
			if (next !== code) writeFileSync(path, next);
		}
	}
};

visit(resolve(packageRoot, "dist"));
console.log("ESM declarations use resolvable relative .js specifiers.");
