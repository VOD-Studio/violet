import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";
import type { HighlightToken } from "./highlight-types";

const LANG_LOADERS = {
	html: () => import("shiki/dist/langs/html.mjs"),
	css: () => import("shiki/dist/langs/css.mjs"),
	scss: () => import("shiki/dist/langs/scss.mjs"),
	less: () => import("shiki/dist/langs/less.mjs"),
	javascript: () => import("shiki/dist/langs/javascript.mjs"),
	typescript: () => import("shiki/dist/langs/typescript.mjs"),
	jsx: () => import("shiki/dist/langs/jsx.mjs"),
	tsx: () => import("shiki/dist/langs/tsx.mjs"),
	vue: () => import("shiki/dist/langs/vue.mjs"),
	json: () => import("shiki/dist/langs/json.mjs"),
	yaml: () => import("shiki/dist/langs/yaml.mjs"),
	markdown: () => import("shiki/dist/langs/markdown.mjs"),
	bash: () => import("shiki/dist/langs/bash.mjs"),
	shell: () => import("shiki/dist/langs/shell.mjs"),
	powershell: () => import("shiki/dist/langs/powershell.mjs"),
	dockerfile: () => import("shiki/dist/langs/dockerfile.mjs"),
	nginx: () => import("shiki/dist/langs/nginx.mjs"),
	makefile: () => import("shiki/dist/langs/makefile.mjs"),
	ini: () => import("shiki/dist/langs/ini.mjs"),
	diff: () => import("shiki/dist/langs/diff.mjs"),
	go: () => import("shiki/dist/langs/go.mjs"),
	rust: () => import("shiki/dist/langs/rust.mjs"),
	python: () => import("shiki/dist/langs/python.mjs"),
	java: () => import("shiki/dist/langs/java.mjs"),
	kotlin: () => import("shiki/dist/langs/kotlin.mjs"),
	swift: () => import("shiki/dist/langs/swift.mjs"),
	ruby: () => import("shiki/dist/langs/ruby.mjs"),
	php: () => import("shiki/dist/langs/php.mjs"),
	c: () => import("shiki/dist/langs/c.mjs"),
	cpp: () => import("shiki/dist/langs/cpp.mjs"),
	csharp: () => import("shiki/dist/langs/csharp.mjs"),
	"objective-c": () => import("shiki/dist/langs/objective-c.mjs"),
	lua: () => import("shiki/dist/langs/lua.mjs"),
	r: () => import("shiki/dist/langs/r.mjs"),
	perl: () => import("shiki/dist/langs/perl.mjs"),
	graphql: () => import("shiki/dist/langs/graphql.mjs"),
	sql: () => import("shiki/dist/langs/sql.mjs"),
	xml: () => import("shiki/dist/langs/xml.mjs"),
	wasm: () => import("shiki/dist/langs/wasm.mjs"),
} satisfies Record<string, () => Promise<unknown>>;

type SupportedLanguage = keyof typeof LANG_LOADERS;

const LANG_ALIAS: Record<string, string> = {
	js: "javascript",
	mjs: "javascript",
	cjs: "javascript",
	ts: "typescript",
	mts: "typescript",
	cts: "typescript",
	sh: "bash",
	zsh: "bash",
	shellsession: "shell",
	ps1: "powershell",
	py: "python",
	rb: "ruby",
	rs: "rust",
	kt: "kotlin",
	"c++": "cpp",
	h: "c",
	hh: "c",
	cc: "cpp",
	cxx: "cpp",
	hpp: "cpp",
	hxx: "cpp",
	cs: "csharp",
	golang: "go",
	docker: "dockerfile",
	mak: "makefile",
	toml: "ini",
	conf: "ini",
	arduino: "cpp",
	yml: "yaml",
	md: "markdown",
};

/**
 * 把任意 lang id 规整为白名单内 id；不在白名单内返回 null（调用方降级纯文本）。
 */
function resolveSupportedLanguage(lang: string): SupportedLanguage | null {
	if (!lang) return null;
	const lower = lang.toLowerCase();
	const aliased = LANG_ALIAS[lower] ?? lower;
	if (Object.hasOwn(LANG_LOADERS, aliased)) return aliased as SupportedLanguage;
	return null;
}

const theme = {
	name: "violet-semantic",
	type: "light" as const,
	colors: { "editor.foreground": "var(--foreground)", "editor.background": "var(--secondary)" },
	tokenColors: [
		{ scope: ["keyword", "storage"], settings: { foreground: "var(--link)" } },
		{ scope: ["string"], settings: { foreground: "var(--success-text)" } },
		{ scope: ["comment", "punctuation"], settings: { foreground: "var(--muted-foreground)" } },
		{ scope: ["constant.numeric"], settings: { foreground: "var(--link)" } },
		{
			scope: ["entity.name.function", "support.function"],
			settings: { foreground: "var(--foreground)", fontStyle: "bold" },
		},
	],
};
let highlighter: Promise<HighlighterCore> | undefined;
function getHighlighter() {
	highlighter ??= createHighlighterCore({
		engine: createOnigurumaEngine(import("shiki/wasm")),
		themes: [theme],
		langs: [],
	}).catch((error: unknown) => {
		highlighter = undefined;
		throw error;
	});
	return highlighter;
}
const languages = new Map<SupportedLanguage, Promise<void>>();
async function ensureLanguage(language: SupportedLanguage) {
	let loading = languages.get(language);
	if (!loading) {
		loading = getHighlighter()
			.then(async (engine) => {
				const languageModule = await LANG_LOADERS[language]();
				await engine.loadLanguage(languageModule.default);
			})
			.catch((error: unknown) => {
				languages.delete(language);
				throw error;
			});
		languages.set(language, loading);
	}
	await loading;
}

/** 按需加载语法并返回保留源码文本的语义色 token。 */
export async function highlightSource(code: string, language: string): Promise<HighlightToken[][]> {
	const resolved = resolveSupportedLanguage(language);
	const engine = await getHighlighter();
	if (resolved) await ensureLanguage(resolved);
	return engine
		.codeToTokens(code, { lang: resolved ?? "plaintext", theme: theme.name })
		.tokens.map((line) =>
			line.map(({ content, color, fontStyle }) => ({ content, color, fontStyle })),
		);
}
