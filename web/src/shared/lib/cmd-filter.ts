/** 命令面板项契约 */
export interface CmdItem {
	id: string;
	/** 显示标题 */
	label: string;
	/** 搜索辅助关键词列表 */
	keywords?: string[];
	/** 命令所属分组名称 */
	group: string;
	/** 副标题或搜索命中摘要 */
	description?: string;
	/** 命令执行回调 */
	run: () => void;
}

/**
 * 根据搜索关键词模糊过滤命令面板项列表（纯函数）。
 *
 * @remarks
 * - 空关键词：返回全部列表；
 * - 以 `>` 开头：进入分组检索模式（如 `> theme`）；
 * - 常规输入：不区分大小写匹配 `label` 与 `keywords`。
 *
 * @param items - 候选命令列表
 * @param query - 用户输入的检索关键词
 *
 * @returns 匹配后的命令子集
 *
 * @example
 * ```ts
 * const filtered = filterCommands(allItems, "> theme");
 * ```
 */
export function filterCommands(items: CmdItem[], query: string): CmdItem[] {
	const q = query.trim();
	if (!q) return items;

	if (q.startsWith(">")) {
		const group = q.slice(1).trim().toLowerCase();
		if (!group) return items;
		return items.filter((i) => i.group.toLowerCase().includes(group));
	}

	const needle = q.toLowerCase();
	return items.filter((i) => {
		if (i.label.toLowerCase().includes(needle)) return true;
		return i.keywords?.some((k) => k.toLowerCase().includes(needle)) ?? false;
	});
}
