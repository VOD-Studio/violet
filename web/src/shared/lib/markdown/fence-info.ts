const languageAliases: Record<string, string> = {
	js: "node",
	javascript: "node",
	rs: "rust",
	ts: "bun",
	typescript: "bun",
};

/** 解析围栏元数据，仅可运行块归一化运行时语言别名，普通代码保留高亮语言。 */
export function parseFenceInfo(info: string): {
	language: string;
	runnable: boolean;
	overrides: string | null;
} {
	const jsonStart = info.indexOf("{");
	const tokens = (jsonStart < 0 ? info : info.slice(0, jsonStart)).trim().split(/\s+/u);
	const sourceLanguage = tokens[0] ?? "";
	const runnable = tokens.slice(1).some((token) => token === "runnable" || token === "run");
	const normalized = sourceLanguage.toLowerCase();
	let overrides: string | null = null;
	if (jsonStart >= 0) {
		try {
			const value: unknown = JSON.parse(info.slice(jsonStart));
			if (value && typeof value === "object" && !Array.isArray(value)) {
				overrides = JSON.stringify(value);
			}
		} catch {
			// 元数据错误不阻止源码展示和运行。
		}
	}
	return {
		language: runnable ? (languageAliases[normalized] ?? normalized) : sourceLanguage,
		runnable,
		overrides,
	};
}
