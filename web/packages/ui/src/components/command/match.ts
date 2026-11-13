import type { ReactNode } from "react";
import type { KbdKey } from "../kbd";

/** 命令面板里的一项：文章、页面、命令，或进入下一级的入口。 */
export interface CommandItem {
	id: string;
	label: string;
	/** 所属分组，对应 groups 里的 id */
	group: string;
	icon?: ReactNode;
	/** 只参与匹配、不显示的词，如英文名或路由路径 */
	keywords?: string[];
	/** 可选的右侧补充信息；路径检索使用 keywords，避免占据操作提示列 */
	hint?: string;
	/** 宿主已注册的快捷键；这里只显示键帽，不注册键盘事件 */
	shortcut?: readonly KbdKey[];
	/** 标题下的纯文本摘要；允许换行完整显示，不解析 HTML */
	description?: string;
	/**
	 * 是否按输入筛选；调用方已经匹配过的结果（全文搜索）传 false，总是显示。
	 * @default true
	 */
	filter?: boolean;
	/** 选中后进入的下一级，如「切换主题」 */
	children?: CommandItem[];
	/** 执行；newTab 为 ⌘↵ / Ctrl ↵，文章与页面在新标签页打开 */
	onSelect?: (options: { newTab: boolean }) => void;
}

/** 一组结果；组的顺序固定，组名 12 号浅色。 */
export interface CommandGroup {
	id: string;
	label: string;
}

/** 匹配到的一项与标题、摘要里要加底色的区间。 */
export interface CommandMatch {
	item: CommandItem;
	/** 标题原文的 UTF-16 [起点, 终点) 区间，没有实际命中时为空 */
	ranges: [number, number][];
	/** 摘要原文的 UTF-16 [起点, 终点) 区间，没有摘要或没有实际命中时为空 */
	descriptionRanges: [number, number][];
}

export interface CommandSection {
	group: CommandGroup;
	matches: CommandMatch[];
}

/** 标题开头就匹配的排前面，其次是标题里含有的，最后是路径或关键词含有的。 */
function rank(item: CommandItem, needle: string): number | null {
	const label = item.label.toLowerCase();
	if (label.startsWith(needle)) return 0;
	if (label.includes(needle)) return 1;
	if (item.hint?.toLowerCase().includes(needle)) return 2;
	if (item.keywords?.some((keyword) => keyword.toLowerCase().includes(needle))) return 2;
	return null;
}

/** 小写转换展开字符时，将每个 UTF-16 单元映射回原字符的完整范围。 */
function lowercaseSourceRanges(label: string): [number, number][] {
	const offsets: [number, number][] = [];
	let source = 0;
	for (const character of label) {
		const range: [number, number] = [source, source + character.length];
		for (let index = 0; index < character.toLowerCase().length; index += 1) {
			offsets.push(range);
		}
		source += character.length;
	}
	return offsets;
}

function ranges(label: string, needles: string[]): [number, number][] {
	if (needles.length === 0) return [];
	const found: [number, number][] = [];
	const haystack = label.toLowerCase();
	const sourceRanges = haystack.length === label.length ? null : lowercaseSourceRanges(label);
	for (const needle of needles) {
		let from = haystack.indexOf(needle);
		while (from !== -1) {
			found.push(
				sourceRanges
					? [sourceRanges[from][0], sourceRanges[from + needle.length - 1][1]]
					: [from, from + needle.length],
			);
			from = haystack.indexOf(needle, from + needle.length);
		}
	}
	found.sort((a, b) => a[0] - b[0]);
	const merged: [number, number][] = [];
	for (const range of found) {
		const previous = merged.at(-1);
		if (previous && range[0] <= previous[1]) {
			previous[1] = Math.max(previous[1], range[1]);
		} else {
			merged.push(range);
		}
	}
	return merged;
}

/**
 * 按输入筛选并分组：不区分大小写，组的顺序固定，组内按匹配位置排序，每组最多 limit 项。
 *
 * @param items - 当前这一级的全部候选
 * @param groups - 分组与顺序；不在其中的分组排在最后、没有组名
 * @param query - 输入框里的字
 * @param limit - 每组最多显示几项
 * @returns 有结果的分组，组内为匹配项与标题、摘要里的高亮区间
 */
export function matchCommands(
	items: CommandItem[],
	groups: CommandGroup[],
	query: string,
	limit = 5,
): CommandSection[] {
	const needle = query.trim().toLowerCase();
	const needles = needle ? [...new Set(needle.split(/\s+/u))] : [];
	const known = new Map(groups.map((group, index) => [group.id, index]));
	const sections = new Map<
		string,
		{ group: CommandGroup; scored: [number, number, CommandMatch][] }
	>();
	items.forEach((item, order) => {
		const score = item.filter === false || !needle ? 0 : rank(item, needle);
		if (score === null) return;
		const group = groups[known.get(item.group) ?? -1] ?? { id: item.group, label: "" };
		const section = sections.get(group.id) ?? { group, scored: [] };
		section.scored.push([
			score,
			order,
			{
				item,
				ranges: ranges(item.label, needles),
				descriptionRanges: ranges(item.description ?? "", needles),
			},
		]);
		sections.set(group.id, section);
	});
	return [...sections.values()]
		.sort(
			(a, b) =>
				(known.get(a.group.id) ?? Number.MAX_SAFE_INTEGER) -
				(known.get(b.group.id) ?? Number.MAX_SAFE_INTEGER),
		)
		.map(({ group, scored }) => ({
			group,
			matches: scored
				.sort((a, b) => a[0] - b[0] || a[1] - b[1])
				.slice(0, limit)
				.map(([, , match]) => match),
		}));
}
