export interface NumberRules {
	min?: number;
	max?: number;
	step: number;
	precision: number;
	allowEmpty: boolean;
}

export function decimalPlaces(value: number): number {
	const [coefficient, exponent = "0"] = String(value).toLowerCase().split("e");
	return Math.max(0, (coefficient.split(".")[1]?.length ?? 0) - Number(exponent));
}

/** 下界与上界接受 register() 返回的 string | number；空串或非数字表示不设界。 */
export function toBound(value: number | string | undefined): number | undefined {
	if (value === undefined || value === "") return undefined;
	const bound = Number(value);
	return Number.isFinite(bound) ? bound : undefined;
}

/** 数字转成普通十进制文本；指数形式的 String(1e-7) 不是可编辑草稿。 */
export function toText(value: string | number | undefined): string {
	if (value === undefined) return "";
	if (typeof value === "string" || !Number.isFinite(value)) return String(value);
	return value.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 20 });
}

export function parseNumber(text: string): number | null {
	if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text.trim())) return null;
	const value = Number(text);
	return Number.isFinite(value) ? value : null;
}

export function normalizeNumber(value: number, rules: NumberRules): number {
	const rounded = Number(
		(value + Math.sign(value) * Number.EPSILON * Math.abs(value)).toFixed(rules.precision),
	);
	return Math.max(rules.min ?? -Infinity, Math.min(rules.max ?? Infinity, rounded));
}

export function formatNumber(value: number | null, precision: number): string {
	return value === null ? "" : value.toFixed(precision);
}

export function normalizeDraft(text: string, previous: number | null, rules: NumberRules) {
	if (text.trim() === "" && rules.allowEmpty) return null;
	const parsed = parseNumber(text);
	if (parsed !== null) return normalizeNumber(parsed, rules);
	return previous === null
		? rules.allowEmpty
			? null
			: normalizeNumber(rules.min ?? 0, rules)
		: normalizeNumber(previous, rules);
}

export function stepNumber(text: string, direction: number, rules: NumberRules): number {
	const parsed = parseNumber(text);
	const base = parsed ?? rules.min ?? 0;
	return normalizeNumber(base + direction * rules.step, rules);
}

export function cleanNumberPaste(text: string): string | null {
	const clean = text.trim().replace(/[,，\s]/g, "");
	const match = /^[¥￥$€£]?([+-]?(?:\d+(?:\.\d*)?|\.\d+))[\p{L}%％°℃℉²³/]*$/u.exec(clean);
	return match && parseNumber(match[1]) !== null ? match[1] : null;
}
