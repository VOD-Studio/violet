import { z } from "zod";

/**
 * 笔记编辑表单 schema。
 *
 * tagsText 是标签的逗号分隔输入形态，提交时拆分为数组；
 * contentMD 必填（服务端同样校验），标题可空但限长。
 */
export const noteSchema = z.object({
	title: z.string().max(120, "标题最多 120 字符"),
	contentMD: z.string().trim().min(1, "正文不能为空"),
	tagsText: z.string(),
});

export type NoteForm = z.infer<typeof noteSchema>;

export const NOTE_FORM_DEFAULTS: NoteForm = {
	title: "",
	contentMD: "",
	tagsText: "",
};

/** 逗号/中文逗号分隔的标签输入拆为数组（去空白去空项）。 */
export function parseTagsText(text: string): string[] {
	return text
		.split(/[,，]/)
		.map((t) => t.trim())
		.filter((t) => t.length > 0);
}
