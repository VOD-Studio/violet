/**
 * latex-autocomplete - LaTeX 自动补全纯逻辑
 *
 * 与 DOM 无关的三段：从输入值+光标提取反斜杠查询（extractQuery）、
 * 前缀优先的候选过滤（filterCommands）、补全替换与光标定位（applyCompletion）。
 * 组件层见 LatexSourceField。
 */
import { LATEX_COMMANDS, type LatexCommand } from "./latex-commands";

export interface LatexQuery {
	/** 反斜杠在输入值中的下标 */
	start: number;
	/** 反斜杠之后、光标之前的查询串（可能为空串） */
	text: string;
}

/**
 * 提取光标处的反斜杠查询。
 * 光标紧邻 `\xxx`（ASCII 字母）或刚输入 `\` 时返回查询；否则 null。
 * 光标停在命令中间时，以光标前段为查询（替换只到光标处，不动后半截）。
 */
export function extractQuery(value: string, cursorPos: number): LatexQuery | null {
	let i = cursorPos;
	while (i > 0 && /[a-zA-Z]/.test(value[i - 1])) i--;
	if (i > 0 && value[i - 1] === "\\") return { start: i - 1, text: value.slice(i, cursorPos) };
	if (cursorPos > 0 && value[cursorPos - 1] === "\\") return { start: cursorPos - 1, text: "" };
	return null;
}

/**
 * 过滤候选：命令名（不含反斜杠）大小写不敏感，
 * 前缀匹配排在包含匹配之前，同组内保持清单原有顺序（常用在前）。
 */
export function filterCommands(query: string, limit = 8): LatexCommand[] {
	if (!query) return LATEX_COMMANDS.slice(0, limit);
	const q = query.toLowerCase();
	const prefix: LatexCommand[] = [];
	const contains: LatexCommand[] = [];
	for (const cmd of LATEX_COMMANDS) {
		const name = cmd.name.slice(1).toLowerCase();
		if (name.startsWith(q)) prefix.push(cmd);
		else if (name.includes(q)) contains.push(cmd);
		if (prefix.length >= limit) break;
	}
	return [...prefix, ...contains].slice(0, limit);
}

/**
 * 应用补全：把 [start, cursorPos) 替换为模板。
 * 返回新值与新光标位置——模板第一个 {} 或 [] 占位符内部；
 * 无占位符时落在模板末尾。
 */
export function applyCompletion(
	value: string,
	cursorPos: number,
	start: number,
	template: string,
): { value: string; cursor: number } {
	const next = value.slice(0, start) + template + value.slice(cursorPos);
	const placeholder = template.search(/\{\}|\[\]/);
	const cursor = placeholder === -1 ? start + template.length : start + placeholder + 1;
	return { value: next, cursor };
}
