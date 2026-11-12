/** 标签被拒绝的原因：重复、到达上限、`validate` 不通过。 */
export type TagRejectionReason = "duplicate" | "max" | "invalid";

/** 一次被拒绝的添加。`message` 是面向用户的一句话，也是读屏播报的内容。 */
export interface TagRejection {
	reason: TagRejectionReason;
	/** 被拒绝的标签；上限被占满时是第一个放不下的标签，没有具体标签（例如拦下的按键）时为空串。 */
	tag: string;
	message: string;
}

/** 生成标签的分隔符：半角逗号、全角逗号、顿号与换行；空格不拆，标签里允许空格。 */
export const TAG_SEPARATORS = /[,，、\r\n]/;

/** 去重与匹配用的键：不分大小写。 */
export function tagKey(tag: string): string {
	return tag.toLowerCase();
}

export function maxMessage(max: number): string {
	return `最多 ${max} 个，删掉一个才能再加`;
}

export interface CommitOptions {
	max?: number;
	validate?: (tag: string) => string | null;
	normalize?: (raw: string) => string;
}

export interface CommitResult {
	/** 提交后的完整列表；没有新增时与传入的内容相同。 */
	tags: string[];
	added: string[];
	/** 本次遇到的第一个拒绝；批量提交时其余拒绝被略过。 */
	rejection: TagRejection | null;
	/** 因重复而被命中的已有标签，用来让它闪一下。 */
	duplicateOf: string | null;
}

/**
 * 把一批原始文本依次加进标签列表：去空白、`normalize`、判上限、去重（不分大小写）、`validate`。
 * 空白段直接略过；上限一满后面的段不再处理。
 */
export function commitTags(
	current: readonly string[],
	parts: readonly string[],
	{ max, validate, normalize }: CommitOptions,
): CommitResult {
	const tags = [...current];
	const added: string[] = [];
	let rejection: TagRejection | null = null;
	let duplicateOf: string | null = null;

	for (const raw of parts) {
		let tag = raw.trim();
		if (normalize) tag = normalize(tag).trim();
		if (!tag) continue;

		if (max !== undefined && tags.length >= max) {
			rejection ??= { reason: "max", tag, message: maxMessage(max) };
			break;
		}
		const key = tagKey(tag);
		const existing = tags.find((item) => tagKey(item) === key);
		if (existing !== undefined) {
			rejection ??= {
				reason: "duplicate",
				tag,
				message: `已经有「${existing}」了`,
			};
			duplicateOf ??= existing;
			continue;
		}
		const problem = validate?.(tag);
		if (problem) {
			rejection ??= { reason: "invalid", tag, message: problem };
			continue;
		}
		tags.push(tag);
		added.push(tag);
	}

	return { tags, added, rejection, duplicateOf };
}
