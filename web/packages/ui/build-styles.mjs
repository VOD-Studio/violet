import { resolve } from "node:path";
import { build } from "esbuild";
import { cssEntries, packageRoot } from "./scripts/registry.mjs";

await build({
	absWorkingDir: packageRoot,
	entryPoints: cssEntries,
	outdir: resolve(packageRoot, "dist"),
	bundle: true,
	loader: { ".css": "css" },
	minify: false,
	logLevel: "info",
});
