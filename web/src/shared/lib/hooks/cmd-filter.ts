export interface CmdItem {
	id: string;
	/** 显示名 */
	label: string;
	/** 关键词（用于匹配） */
	keywords?: string[];
	/** 分组 */
	group: string;
	/** 副标题（如搜索 snippet） */
	description?: string;
	/** 执行 */
	run: () => void;
}

/**
 * filterCommands - 模糊过滤命令列表（纯函数）
 *
 * 规则：
 * - 空 query 返回全部
 * - 以 ">" 开头：仅匹配 group（指令模式，如 "> Dark" → group="theme"）
 * - 否则：label 或 keywords 子串匹配（大小写不敏感）
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
