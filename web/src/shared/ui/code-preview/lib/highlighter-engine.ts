import { createAsyncLoader } from "@shared/lib/create-async-loader";
import { createHighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";

/** auto 输出随 color-scheme 切换的双主题样式，不依赖线程读取页面配色。 */
export type HighlightTheme = "dark" | "light" | "auto";

// 字面量 import 让构建器仅输出白名单内的语言分片，并在使用时下载。
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

const THEME = "github-dark";

const THEME_LIGHT = "github-light";

/** 语言别名 → 白名单 id（处理 sh/bash、yml/yaml 等常见等价写法） */
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
	if (aliased in LANG_LOADERS) return aliased as SupportedLanguage;
	return null;
}

/**
 * 获取共享高亮器，首次调用时准备 WASM 引擎及明暗主题。
 *
 * @returns 共享的初始化 Promise；失败后下次调用可重试，语言语法由 ensureLanguage 单独准备。
 */
const getHighlighter = createAsyncLoader(() =>
	createHighlighterCore({
		engine: createOnigurumaEngine(import("shiki/wasm")),
		themes: [
			() => import("shiki/dist/themes/github-dark.mjs"),
			() => import("shiki/dist/themes/github-light.mjs"),
		],
	}),
);

const languagePreparations = new Map<SupportedLanguage, () => Promise<void>>();

/**
 * 准备白名单语言的语法，复用同语言的并发加载请求。
 *
 * @param lang - 经过 resolveSupportedLanguage 校验的语言标识。
 * @returns 语法可用后完成的 Promise；加载失败由调用方保留纯文本。
 */
function ensureLanguage(lang: SupportedLanguage): Promise<void> {
	let load = languagePreparations.get(lang);
	if (!load) {
		load = createAsyncLoader(async () => {
			const highlighter = await getHighlighter();
			if (highlighter.getLoadedLanguages().includes(lang)) return;
			await highlighter.loadLanguage(LANG_LOADERS[lang]);
		});
		languagePreparations.set(lang, load);
	}
	return load();
}

async function prepareHighlight(lang: string) {
	const resolved = resolveSupportedLanguage(lang);
	const highlighter = await getHighlighter();
	if (resolved) await ensureLanguage(resolved);
	return { highlighter, language: resolved ?? "plaintext" };
}

/**
 * 准备白名单语法并生成完整代码 HTML，不访问页面 DOM。
 *
 * @param language - 支持别名；未知语言按纯文本处理。
 * @param theme - 固定明暗配色或自动双主题配色。
 * @returns 完整高亮结果；资源或计算失败时拒绝，不用旧源码充当结果。
 */
export async function highlightSource(
	code: string,
	language: string,
	theme: HighlightTheme,
): Promise<string> {
	const prepared = await prepareHighlight(language);
	return prepared.highlighter.codeToHtml(code, {
		lang: prepared.language,
		...(theme === "auto"
			? { themes: { light: THEME_LIGHT, dark: THEME }, defaultColor: "light-dark()" }
			: { theme: theme === "light" ? THEME_LIGHT : THEME }),
	});
}
