/** 围栏长于源码中的同类符号串，元数据含反引号时改用波浪号。 */
export function renderCodeFence(source: string, info: string): string {
	const marker = info.includes("`") ? "~" : "`";
	const runs = source.match(marker === "`" ? /`+/g : /~+/g) ?? [];
	const length = runs.reduce((maximum, run) => Math.max(maximum, run.length + 1), 3);
	const fence = marker.repeat(length);
	return `${fence}${info}\n${source}\n${fence}`;
}
