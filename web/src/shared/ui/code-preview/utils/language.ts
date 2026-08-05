/**
 * 代码语言工具：扩展名 -> shiki 语言 ID 映射
 */

/** 扩展名到 shiki 语言 ID 的映射（覆盖常见代码文件） */
const EXTENSION_MAP: Record<string, string> = {
	js: "javascript",
	mjs: "javascript",
	cjs: "javascript",
	jsx: "jsx",
	ts: "typescript",
	tsx: "tsx",
	go: "go",
	rs: "rust",
	java: "java",
	kt: "kotlin",
	swift: "swift",
	py: "python",
	rb: "ruby",
	php: "php",
	c: "c",
	h: "c",
	cpp: "cpp",
	hpp: "cpp",
	cc: "cpp",
	cs: "csharp",
	css: "css",
	scss: "scss",
	sass: "sass",
	less: "less",
	html: "html",
	xml: "xml",
	vue: "vue",
	svelte: "svelte",
	json: "json",
	yml: "yaml",
	yaml: "yaml",
	toml: "toml",
	ini: "ini",
	conf: "ini",
	sh: "bash",
	bash: "bash",
	zsh: "bash",
	sql: "sql",
	lua: "lua",
	md: "markdown",
	markdown: "markdown",
	dockerfile: "dockerfile",
};

/** 根据文件名推断 shiki 语言 ID，无法识别返回 "text"（纯文本） */
export function inferLanguage(name?: string): string {
	if (!name) return "text";
	const lower = name.toLowerCase();
	// 特殊文件名
	if (lower === "dockerfile") return "dockerfile";
	if (lower === "makefile") return "makefile";
	const ext = lower.includes(".") ? (lower.split(".").pop() ?? "") : "";
	return EXTENSION_MAP[ext] ?? "text";
}
