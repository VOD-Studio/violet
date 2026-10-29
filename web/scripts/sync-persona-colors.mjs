import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(webRoot, "src/features/persona-browse/ui/persona-identity.generated.css");
const { outputFiles } = await build({
	entryPoints: [resolve(webRoot, "src/features/persona-browse/model/identity-colors.ts")],
	bundle: true,
	write: false,
	platform: "node",
	format: "esm",
});
const { generatePersonaIdentityCss } = await import(
	`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`
);
const expected = generatePersonaIdentityCss("#7560b3");
let actual;
try {
	actual = readFileSync(target, "utf8");
} catch (error) {
	if (error.code !== "ENOENT") throw error;
}
if (actual !== expected) {
	if (process.argv.includes("--check")) {
		throw new Error("Persona identity colors are stale. Run pnpm colors:persona.");
	}
	writeFileSync(target, expected);
}
console.log(
	process.argv.includes("--check")
		? "Persona identity colors are current."
		: "Persona identity colors synchronized.",
);
