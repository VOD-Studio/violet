/**
 * shiki 单例 highlighter（核心 + 按需语言加载）
 *
 * 刻意绕开 shiki/bundle/full（默认入口会内联 200+ 语言的 import 工厂索引），
 * 改用 shiki/core 拿裸 HighlighterCore，再按白名单 loadLanguage 精细加载。
 * 这样 emacs-lisp / wolfram / angular-ts 等博客永不会出现的语言 grammar
 * 不会进入构建产物，只有白名单内的语言会生成独立 chunk 且按需加载。
 *
 * 与编辑器（features/editor，走 lowlight + highlight.js）的区别：
 * 前台展示统一用 shiki，主题 github-dark，与编辑时实时高亮视觉一致即可。
 */
import { getSingletonHighlighterCore, type HighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";

/**
 * 语言包加载器静态映射：键即白名单语言 id。
 *
 * 必须用字面量 import：vite 才能静态解析并预构建/分包，运行时按需拉取。
 * 此前用模板 import + @vite-ignore（`shiki/dist/langs/${lang}.mjs`），裸
 * specifier 原样进入浏览器直接抛 TypeError，白名单内语言全部静默降级
 * 为纯文本（无语法高亮）。独立 chunk 只含映射内语言，未列出语言不进构建。
 */
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

/** 白名单语言 id（= LANG_LOADERS 键） */
type SupportedLanguage = keyof typeof LANG_LOADERS;

/** 主题（前台展示固定 github-dark，与原 useShikiHighlight/useCodeHighlight 一致） */
const THEME = "github-dark";

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
export function resolveSupportedLanguage(lang: string): SupportedLanguage | null {
	if (!lang) return null;
	const lower = lang.toLowerCase();
	const aliased = LANG_ALIAS[lower] ?? lower;
	if (aliased in LANG_LOADERS) return aliased as SupportedLanguage;
	return null;
}

let highlighterPromise: Promise<HighlighterCore> | null = null;

/**
 * getHighlighter - 获取单例 highlighter（懒初始化）
 *
 * 首次调用时创建：engine 用 oniguruma（wasm，与原 shiki/bundle/full 一致），
 * 预加载 github-dark 主题，不预加载任何语言（按需 loadLanguage）。
 */
export function getHighlighter(): Promise<HighlighterCore> {
	if (!highlighterPromise) {
		// engine 传入内联 wasm（shiki/wasm re-export @shikijs/engine-oniguruma/wasm-inlined，
		// base64 内联，无需运行时 fetch），与 shiki/bundle/full 的 engine 装配方式一致。
		highlighterPromise = getSingletonHighlighterCore({
			engine: createOnigurumaEngine(import("shiki/wasm")),
			themes: [() => import("shiki/dist/themes/github-dark.mjs")],
		});
	}
	return highlighterPromise;
}

const loadingLanguages = new Map<string, Promise<void>>();

/**
 * ensureLanguage - 确保指定语言已加载到 highlighter（去重并发加载）。
 *
 * @param lang 白名单内语言 id（外部应先用 resolveSupportedLanguage 校验）
 */
export function ensureLanguage(lang: SupportedLanguage): Promise<void> {
	const pending = loadingLanguages.get(lang);
	if (pending) return pending;
	// 已加载直接返回（getLoadedLanguages 同步可查）
	const hl = highlighterPromise;
	const p = (async () => {
		const highlighter = await (hl ?? getHighlighter());
		if (highlighter.getLoadedLanguages().includes(lang)) return;
		await highlighter.loadLanguage(LANG_LOADERS[lang]);
	})();
	loadingLanguages.set(lang, p);
	return p;
}

/**
 * highlightCode - 高亮代码字符串为 HTML
 *
 * @param code 原始代码
 * @param lang 任意 lang id（自动别名解析；不在白名单内降级为 plaintext 纯文本，
 *             仍带主题背景但不做语法上色）
 * @returns 高亮 HTML（shiki 输出）
 */
export async function highlightCode(code: string, lang: string): Promise<string> {
	const resolved = resolveSupportedLanguage(lang);
	const highlighter = await getHighlighter();
	// 不在白名单内的语言用 plaintext 兜底（shiki 内置，无需 loadLanguage）
	const finalLang = resolved ?? "plaintext";
	if (resolved) {
		await ensureLanguage(resolved);
	}
	return highlighter.codeToHtml(code, { lang: finalLang, theme: THEME });
}

/** Theme 名导出，供外部复用样式约定 */
export { THEME as SHIKI_THEME };
