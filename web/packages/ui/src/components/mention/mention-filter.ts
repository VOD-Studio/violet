import { pinyinInitials } from "../../lib/pinyin-initials";
import { MENTION_ALL_LABEL, type MentionCandidate } from "./mention";

/** `@` 之后的查询窗口：设计稿规定最多 20 个字。 */
export const MENTION_QUERY_LIMIT = 20;

/** 候选列表最多展示的条数：设计稿规定 6 条，再多靠继续输入收窄。 */
export const MENTION_CANDIDATE_LIMIT = 6;

/** 光标前正在成形的提及：`@` 的起点、查询词与光标位置。 */
export interface MentionTrigger {
	/** `@` 在文本中的下标；插入时从这里到 `end` 整体替换 */
	start: number;
	/** 查询词结束位置，即光标处 */
	end: number;
	/** `@` 后到光标之间的输入，可能为空串 */
	query: string;
}

const TRIGGER_PATTERN = new RegExp(`(?:^|\\s)@([^\\s@]{0,${MENTION_QUERY_LIMIT}})$`);

/**
 * 从光标前的文本解析提及触发态。
 *
 * `@` 必须在词首（行首或空白之后），查询词不含空白与第二个 `@`，超过 20 个字就不再是提及。
 * 邮箱里的 `@` 不满足词首条件，不会触发。
 *
 * @param text - 光标所在的整段文本
 * @param caret - 光标位置，默认文本末尾
 */
export function parseMentionTrigger(text: string, caret = text.length): MentionTrigger | null {
	const end = Math.max(0, Math.min(caret, text.length));
	const before = text.slice(0, end);
	const match = TRIGGER_PATTERN.exec(before);
	if (!match) return null;
	const query = match[1];
	return { start: end - query.length - 1, end, query };
}

/** 「全体成员」条目按人数渲染，也算一种匹配字段（输入「23」能找到 23 人的全体）。 */
function matches(candidate: MentionCandidate, needle: string) {
	// 列表里「全体成员」这一行不叫 displayName（占位符仍是 @所有人），筛选按列表可见名称走
	const label = candidate.memberCount === undefined ? candidate.displayName : MENTION_ALL_LABEL;
	const name = label.toLowerCase();
	if (name.includes(needle) || candidate.username.toLowerCase().includes(needle)) return true;
	// 拼音只做首字母前缀：输入「lj」找「林间」，不承担全拼与多音字
	if (pinyinInitials(label).toLowerCase().startsWith(needle)) return true;
	return candidate.memberCount !== undefined && `${candidate.memberCount} 人`.includes(needle);
}

/**
 * 按查询词筛选候选：「全体成员」恒置顶，其余保持传入顺序，再截到上限。
 *
 * 显示名与用户名按字面忽略大小写包含匹配，显示名另按拼音首字母前缀匹配。
 * 「最近发言者排前」由调用方在传入顺序里表达——筛选不读消息，只保留顺序。
 *
 * @param candidates - 调用方排好序的候选（全体条目可在任意位置）
 * @param query - `@` 后已经输入的内容，空串表示列出全部
 * @param limit - 展示条数上限，默认 {@link MENTION_CANDIDATE_LIMIT}
 */
export function filterMentionCandidates(
	candidates: readonly MentionCandidate[],
	query: string,
	limit = MENTION_CANDIDATE_LIMIT,
): MentionCandidate[] {
	const needle = query.trim().toLowerCase();
	const matched =
		needle === "" ? [...candidates] : candidates.filter((item) => matches(item, needle));
	const broadcast = matched.filter((item) => item.memberCount !== undefined);
	if (broadcast.length === 0) return matched.slice(0, limit);
	return [...broadcast, ...matched.filter((item) => item.memberCount === undefined)].slice(
		0,
		limit,
	);
}
