const languageAliases: Record<string, string> = {
	js: "node",
	javascript: "node",
	rs: "rust",
	ts: "bun",
	typescript: "bun",
};

/** 围栏的显示元数据与独立执行声明。 */
export interface FenceInfo {
	language: string;
	runnable: boolean;
	overrides: string | null;
	filename: string | null;
	highlightLines: string | null;
}

const lineSpec = /^\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$/u;

/**
 * 从围栏首行读取未经 Markdown 反转义的元数据。
 *
 * @param source - Markdown 原文或 marked 的原始代码块 token。
 * @param offset - 围栏节点在原文中的起始位置；仅截取该位置所在首行。
 * @returns 原始 info string；没有围栏时返回 undefined，供调用方回退到解析器元数据。
 */
export function readRawFenceInfo(source: string, offset = 0): string | undefined {
	let end = offset;
	while (end < source.length && source[end] !== "\n" && source[end] !== "\r") end++;
	const header = source.slice(offset, end);
	return header.match(/^[ ]{0,3}(?:>[ \t]{0,3})*(?:`{3,}|~{3,})(.*)$/u)?.[1];
}

/** 解析围栏元数据，仅可运行块归一化运行时语言别名。 */
export function parseFenceInfo(info: string): FenceInfo {
	const language = info.trimStart().match(/^\S+/u)?.[0] ?? "";
	let rest = info.trimStart().slice(language.length).trimStart();
	const result: FenceInfo = {
		language,
		runnable: false,
		overrides: null,
		filename: null,
		highlightLines: null,
	};
	while (rest) {
		if (rest.startsWith('title="')) {
			const quoted = rest.slice(6).match(/^"(?:[^"\\]|\\.)*"/u)?.[0];
			if (!quoted) break;
			try {
				result.filename = JSON.parse(quoted);
			} catch {
				// 无效转义不影响源码与其余有效元数据。
			}
			rest = rest.slice(6 + quoted.length).trimStart();
			continue;
		}
		if (rest.startsWith("{")) {
			const end = rest.indexOf("}");
			const rows = rest.slice(1, end).replace(/\s+/gu, "");
			if (end >= 0 && lineSpec.test(rows)) {
				result.highlightLines = rows;
				rest = rest.slice(end + 1).trimStart();
				continue;
			}
			try {
				const value: unknown = JSON.parse(rest);
				if (value && typeof value === "object" && !Array.isArray(value)) {
					result.overrides = JSON.stringify(value);
				}
			} catch {
				// 末尾资源 JSON 错误不阻止源码展示。
			}
			break;
		}
		const token = rest.match(/^\S+/u)?.[0] ?? "";
		if (token === "run" || token === "runnable") result.runnable = true;
		rest = rest.slice(token.length).trimStart();
	}
	if (result.runnable) {
		const normalized = language.toLowerCase();
		result.language = languageAliases[normalized] ?? normalized;
	}
	return result;
}

/** 将显示与执行元数据写回围栏，文件名使用 JSON 字符串转义。 */
export function serializeFenceInfo(info: FenceInfo): string {
	const tokens = [info.language];
	if (info.filename !== null) tokens.push(`title=${JSON.stringify(info.filename)}`);
	if (info.highlightLines && lineSpec.test(info.highlightLines)) {
		tokens.push(`{${info.highlightLines}}`);
	}
	if (info.runnable) tokens.push("runnable");
	if (info.overrides) {
		try {
			const value: unknown = JSON.parse(info.overrides);
			if (value && typeof value === "object" && !Array.isArray(value)) {
				tokens.push(JSON.stringify(value));
			}
		} catch {
			// 无效资源声明不写入围栏，也不改变源码。
		}
	}
	if (!tokens[0] && tokens.length > 1) tokens[0] = "text";
	return tokens.join(" ");
}

/** 将紧凑行号范围映射为源码内的升序行号，不展开超出源码的范围。
 *
 * @param lineCount - 源码的实际行数；非有限值不展开。
 */
export function parseHighlightedLines(
	spec: string | null | undefined,
	lineCount: number,
): number[] {
	if (!spec || !Number.isFinite(lineCount) || lineCount < 1) return [];
	const compact = spec.replace(/\s+/gu, "");
	if (!lineSpec.test(compact)) return [];
	const maximum = Math.floor(lineCount);
	const selected = new Set<number>();
	for (const part of compact.split(",")) {
		const [first, last = first] = part.split("-");
		const start = Math.max(1, Number(first));
		const end = Math.min(maximum, Number(last));
		for (let row = start; row <= end; row++) selected.add(row);
	}
	return [...selected].sort((a, b) => a - b);
}
