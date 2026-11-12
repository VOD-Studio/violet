import type { ReactNode } from "react";
import type { KbdKey } from "../kbd";

/** 命令面板里的一项：文章、页面、命令，或进入下一级的入口。 */
export interface CommandItem {
	id: string;
	label: string;
	/** 所属分组，对应 groups 里的 id */
	group: string;
	icon?: ReactNode;
	/** 只参与匹配、不显示的词，如英文名 */
	keywords?: string[];
	/** 右侧浅色的路径，页面用 */
	hint?: string;
	/** 右侧的快捷键，命令用 */
	shortcut?: readonly KbdKey[];
	/** 标题下的第二行，全文结果的摘要 */
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

/** 匹配到的一项与标题里要加底色的区间。 */
export interface CommandMatch {
	item: CommandItem;
	/** 标题里匹配到的 [起点, 终点)，没有输入或只匹配到关键词时为空 */
	ranges: [number, number][];
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

function ranges(label: string, needle: string): [number, number][] {
	if (!needle) return [];
	const found: [number, number][] = [];
	const haystack = label.toLowerCase();
	let from = haystack.indexOf(needle);
	while (from !== -1) {
		found.push([from, from + needle.length]);
		from = haystack.indexOf(needle, from + needle.length);
	}
	return found;
}

/**
 * 按输入筛选并分组：不区分大小写，组的顺序固定，组内按匹配位置排序，每组最多 limit 项。
 *
 * @param items - 当前这一级的全部候选
 * @param groups - 分组与顺序；不在其中的分组排在最后、没有组名
 * @param query - 输入框里的字
 * @param limit - 每组最多显示几项
 * @returns 有结果的分组，组内为匹配项与标题里的高亮区间
 */
export function matchCommands(
	items: CommandItem[],
	groups: CommandGroup[],
	query: string,
	limit = 5,
): CommandSection[] {
	const needle = query.trim().toLowerCase();
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
		section.scored.push([score, order, { item, ranges: ranges(item.label, needle) }]);
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
