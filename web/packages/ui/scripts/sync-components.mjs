import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { generatedPackageFields, generatedSources, packageRoot, validateManifest } from "./registry.mjs";

validateManifest();
const check = process.argv.includes("--check");
const stale = [];
for (const [path, content] of generatedSources()) {
	const target = resolve(packageRoot, path);
	let actual;
	try {
		actual = readFileSync(target, "utf8");
	} catch {
		actual = undefined;
	}
	if (actual !== content) {
		if (check) stale.push(path);
		else writeFileSync(target, content);
	}
}

const packagePath = resolve(packageRoot, "package.json");
const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
const { sourceExports, distExports } = generatedPackageFields();
if (JSON.stringify(packageJson.exports) !== JSON.stringify(sourceExports) || JSON.stringify(packageJson.publishConfig.exports) !== JSON.stringify(distExports)) {
	if (check) stale.push("package.json exports");
	else {
		packageJson.exports = sourceExports;
		packageJson.publishConfig.exports = distExports;
		writeFileSync(packagePath, `${JSON.stringify(packageJson, null, "\t")}\n`);
	}
}
if (stale.length) throw new Error(`Generated files are stale: ${stale.join(", ")}. Run pnpm --filter @violet/ui sync.`);
console.log(check ? "Component registry outputs are current." : "Component registry outputs synchronized.");
