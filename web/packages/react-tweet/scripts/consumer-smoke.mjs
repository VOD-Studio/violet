import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("../", import.meta.url));
const metadata = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const require = createRequire(resolve(root, "package.json"));
const temporary = realpathSync(mkdtempSync(resolve(tmpdir(), "react-tweet-consumer-")));
const consumer = resolve(temporary, "consumer");
const keep = process.argv.includes("--keep");
mkdirSync(consumer);
const run = (command, args, cwd, capture = false) => {
	const result = spawnSync(command, args, { cwd, env: process.env, encoding: "utf8", stdio: capture ? "pipe" : "inherit" });
	if (result.error) throw result.error;
	assert.equal(result.status, 0, `${command} ${args.join(" ")} failed.\n${result.stderr ?? ""}`);
	return result.stdout;
};
const write = (name, value) => writeFileSync(resolve(consumer, name), value);
const version = (name) => JSON.parse(readFileSync(require.resolve(`${name}/package.json`), "utf8")).version;

try {
	run(process.execPath, ["scripts/sync-readme.mjs", "--check"], root);
	run("pnpm", ["pack", "--pack-destination", temporary], root);
	run(process.execPath, ["scripts/render-examples.mjs", "--check"], root);
	const tarballs = readdirSync(temporary).filter((name) => name.endsWith(".tgz"));
	assert.equal(tarballs.length, 1);
	const tarball = resolve(temporary, tarballs[0]);
	const files = run("tar", ["-tzf", tarball], temporary, true).trim().split("\n").map((name) => name.replace(/^package\//, ""));
	for (const name of ["package.json", "README.md", "README.zh-CN.md", "CHANGELOG.md", "LICENSE", "dist/index.js", "dist/unstyled.js", "dist/unstyled.d.ts", "dist/api.js", "dist/api.d.ts", "dist/styles.css", "dist/tweet/tweet.css", "dist/tweet/media.css"])
		assert.ok(files.includes(name), `Missing packed file: ${name}`);
	for (const name of readdirSync(resolve(root, "src/tweet/icons")))
		assert.ok(files.includes(`dist/tweet/icons/${name}`), `Missing icon: ${name}`);
	for (const name of files)
		assert.ok(/^(?:package\.json|README(?:\.zh-CN)?\.md|CHANGELOG\.md|LICENSE|dist\/.+)$/.test(name) && !/\.test\.|^dist\/test\//.test(name), `Unexpected packed file: ${name}`);
	const packed = JSON.parse(run("tar", ["-xzOf", tarball, "package/package.json"], temporary, true));
	assert.equal(packed.private, undefined);
	assert.equal(packed.main, "./dist/index.js");
	assert.equal(packed.types, "./dist/unstyled.d.ts");
	assert.equal(packed.license, "MIT");
	for (const [entry, target] of [[".", "index"], ["./unstyled", "unstyled"], ["./api", "api"]]) {
		assert.equal(packed.exports[entry].import, `./dist/${target}.js`);
		assert.equal(packed.exports[entry].types, `./dist/${target === "index" ? "unstyled" : target}.d.ts`);
	}
	assert.equal(packed.exports["./styles.css"], "./dist/styles.css");
	assert.equal(packed.exports["./package.json"], "./package.json");
	assert.ok(packed.sideEffects.includes("./dist/index.js"));
	assert.ok(packed.sideEffects.includes("**/*.css"));
	assert.deepEqual(packed.dependencies ?? {}, {}, "Runtime must not gain hidden site dependencies.");
	write("package.json", JSON.stringify({
		name: "react-tweet-independent-consumer", private: true, type: "module",
		dependencies: { [metadata.name]: `file:${tarball}`, react: version("react"), "react-dom": version("react-dom") },
		devDependencies: { typescript: version("typescript"), "@types/react": version("@types/react"), "@types/react-dom": version("@types/react-dom") },
	}, null, 2));
	write("pnpm-workspace.yaml", "packages: []\n");
	run("pnpm", ["install", "--prefer-offline", "--ignore-scripts", "--no-frozen-lockfile"], consumer);
	const consumerRequire = createRequire(resolve(consumer, "package.json"));
	const entry = realpathSync(consumerRequire.resolve(metadata.name));
	assert.ok(entry.startsWith(`${consumer}${sep}`) && entry.endsWith(`${sep}dist${sep}index.js`), "Consumer must resolve installed dist, not workspace source.");
	cpSync(resolve(root, "examples"), resolve(consumer, "examples"), { recursive: true });
	write("types.tsx", `import { EmbeddedTweet, Tweet, TweetCard, type TweetData, type TweetFetcher, type TweetMediaRenderers } from "${metadata.name}";
import { EmbeddedTweet as Unstyled } from "${metadata.name}/unstyled";
import { getTweet, parseTweetId, type GetTweetOptions } from "${metadata.name}/api";
const data: TweetData = { url: "https://x.com/i/web/status/20", availability: "private" };
const fetcher: TweetFetcher = async (_id, { signal }) => { signal.throwIfAborted(); return data; };
const media: TweetMediaRenderers = { onOpenPhoto: (photos, index, trigger) => { console.log(photos[index].url); trigger.focus(); } };
const options: GetTweetOptions = { signal: new AbortController().signal };
export const nodes = [<EmbeddedTweet tweet={data} {...media} />, <Tweet id="20" fetcher={fetcher} />, <TweetCard contentSlot="Card" />, <Unstyled tweet={data} />];
export const api = [getTweet, parseTweetId, options];
`);
	const compilerOptions = { target: "ES2022", lib: ["ES2022", "DOM", "DOM.Iterable"], strict: true, noEmit: true, skipLibCheck: false, jsx: "react-jsx" };
	write("tsconfig.json", JSON.stringify({ compilerOptions: { ...compilerOptions, module: "ESNext", moduleResolution: "Bundler" }, include: ["types.tsx", "examples/**/*.tsx"] }));
	write("tsconfig.nodenext.json", JSON.stringify({ compilerOptions: { ...compilerOptions, module: "NodeNext", moduleResolution: "NodeNext" }, files: ["types.tsx"] }));
	run("pnpm", ["exec", "tsc", "-p", "tsconfig.json"], consumer);
	run("pnpm", ["exec", "tsc", "-p", "tsconfig.nodenext.json"], consumer);
	write("ssr.mjs", `import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { EmbeddedTweet, Tweet, TweetCard } from "${metadata.name}/unstyled";
import { parseTweetId, getTweet } from "${metadata.name}/api";
const tweet = { url: "https://x.com/demo/status/20", availability: "available", snapshot: { author: { name: "Demo Author", handle: "demo" }, text: "Consumer snapshot", publishedAt: "2026-09-14T09:30:00.000Z" } };
const render = () => renderToString(createElement(EmbeddedTweet, { tweet, locale: "en-US", timeZone: "UTC" }));
process.env.TZ = "Pacific/Honolulu";
const first = render();
process.env.TZ = "Asia/Shanghai";
assert.equal(render(), first, "SSR must not depend on server timezone.");
assert.match(first, /Consumer snapshot/);
assert.match(first, /Demo Author/);
assert.ok(!/<iframe|<script/.test(first));
const hidden = renderToString(createElement(EmbeddedTweet, { tweet: { ...tweet, availability: "private" } }));
assert.ok(!hidden.includes("Consumer snapshot"));
let called = false;
const loading = renderToString(createElement(Tweet, { id: "20", fetcher: async () => { called = true; return tweet; } }));
assert.equal(called, false);
assert.match(loading, /aria-busy="true"/);
assert.match(renderToString(createElement(TweetCard, { contentSlot: "Independent card" })), /Independent card/);
assert.equal(parseTweetId("https://x.com/demo/status/20"), "20");
assert.equal(parseTweetId("https://example.com/demo/status/20"), null);
await assert.rejects(getTweet("invalid"), TypeError);
console.log("Installed tarball: SSR, unavailable content, loading and API contracts passed.");
`);
	run(process.execPath, ["ssr.mjs"], consumer);
	const browser = await build({
		absWorkingDir: consumer,
		stdin: { contents: `import { createElement } from "react"; import { createRoot } from "react-dom/client"; import { EmbeddedTweet } from "${metadata.name}"; createRoot(document.getElementById("root")).render(createElement(EmbeddedTweet, { tweet: { url: "/post", availability: "unavailable" } }));`, resolveDir: consumer, loader: "js" },
		bundle: true, minify: true, format: "esm", platform: "browser", outdir: "browser", write: false, metafile: true, loader: { ".svg": "file" }, define: { "process.env.NODE_ENV": '"production"' },
	});
	const css = browser.outputFiles.find((file) => file.path.endsWith(".css"));
	assert.ok(css, "A named root import must preserve automatic CSS under production tree shaking.");
	assert.ok(css.text.includes(".v-tweet") && css.text.includes("mask") && css.text.includes("color-scheme"));
	for (const name of readdirSync(resolve(root, "src/tweet/icons")))
		assert.ok(Object.keys(browser.metafile.inputs).some((path) => path.endsWith(`/tweet/icons/${name}`)), `Bundler did not resolve ${name}`);
	for (const name of ["unstyled", "api"]) {
		const result = await build({
			absWorkingDir: consumer,
			stdin: { contents: name === "api" ? `export { getTweet, parseTweetId } from "${metadata.name}/api";` : `export { EmbeddedTweet, TweetCard, Tweet } from "${metadata.name}/unstyled";`, resolveDir: consumer, loader: "js" },
			bundle: true, format: "esm", platform: "node", write: false, metafile: true,
		});
		const inputs = Object.keys(result.metafile.inputs);
		assert.ok(!inputs.some((path) => /\.(css|svg)$/.test(path)), `${name} must not load CSS/assets.`);
		if (name === "api") assert.ok(!inputs.some((path) => /node_modules\/(react|react-dom)\//.test(path)), "API must not pull in React.");
	}
	console.log(`${metadata.name}@${metadata.version} independent consumer passed (no external tweet requests).`);
} finally {
	if (keep) console.log(`Kept ${temporary}`);
	else rmSync(temporary, { recursive: true, force: true });
}
