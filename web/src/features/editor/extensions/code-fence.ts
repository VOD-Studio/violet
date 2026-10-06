/** 围栏长于源码中的反引号串，避免嵌套代码示例提前闭合。 */
export function renderCodeFence(source: string, info: string): string {
	const runs = source.match(/`+/g) ?? [];
	const length = runs.reduce((maximum, run) => Math.max(maximum, run.length + 1), 3);
	const fence = "`".repeat(length);
	return `${fence}${info}\n${source}\n${fence}`;
}
