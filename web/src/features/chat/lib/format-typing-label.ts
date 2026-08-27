/**
 * 格式化"正在输入"提示文案：≤2 人列全名，≥3 人展示前两位全名并封顶为总人数。
 *
 * @param names 当前正在输入的成员展示名，按最近活跃排序
 * @returns 展示文案；无人输入时为 null
 */
export function formatTypingLabel(names: string[]): string | null {
	if (names.length === 0) return null;
	if (names.length === 1) return `${names[0]}正在输入…`;
	if (names.length === 2) return `${names[0]}和${names[1]}正在输入…`;
	return `${names[0]}、${names[1]}等 ${names.length} 人正在输入…`;
}
