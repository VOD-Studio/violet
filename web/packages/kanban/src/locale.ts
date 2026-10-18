/** 内置文案的语言。 */
export type Locale = "en" | "zh-CN";

/** 把模板中的 `{name}` 替换为对应值；没有给出的占位符原样保留。 */
export function formatMessage(template: string, values: Record<string, string | number>): string {
	return template.replace(/\{(\w+)\}/g, (match, name: string) =>
		name in values ? String(values[name]) : match,
	);
}
