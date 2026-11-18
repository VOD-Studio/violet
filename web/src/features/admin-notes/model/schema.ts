import { NOTE_TYPES, type NotePitfall } from "@entities/note/model/types";
import { z } from "zod";
import type { AdminNote, NoteSaveRequest } from "./types";

const EMPTY_PITFALL: NotePitfall = {
	symptom: "",
	cause: "",
	remedy: "",
	resolved: false,
	code: "",
};

/**
 * 笔记编辑表单 schema。
 *
 * tagsText 是标签的逗号分隔输入形态，提交时拆分为数组；
 * contentMD 必填（服务端同样校验），标题可空但限长。
 */
export const noteSchema = z.object({
	title: z.string().max(120, "标题最多 120 字符"),
	contentMD: z.string().refine((value) => value.trim().length > 0, "正文不能为空"),
	tagsText: z.string(),
	journal: z.object({
		type: z.enum(NOTE_TYPES),
		project_id: z.string().nullable(),
		pitfall: z.object({
			symptom: z.string(),
			cause: z.string(),
			remedy: z.string(),
			resolved: z.boolean(),
			code: z.string(),
		}),
	}),
});

export type NoteForm = z.infer<typeof noteSchema>;

/** 表单中的踩坑字段始终有空值，用于受控输入。 */
export type NoteJournalForm = NoteForm["journal"];

export const NOTE_FORM_DEFAULTS: NoteForm = {
	title: "",
	contentMD: "",
	tagsText: "",
	journal: { type: "unclassified", project_id: null, pitfall: EMPTY_PITFALL },
};

/**
 * 从详情恢复表单；尚未填写的踩坑段落使用空字符串。
 *
 * @returns 可用于 RHF reset 的完整表单值
 */
export function noteToForm(note: AdminNote): NoteForm {
	return {
		title: note.title,
		contentMD: note.content_md,
		tagsText: note.tags.join(", "),
		journal: { ...note.journal, pitfall: note.journal.pitfall ?? EMPTY_PITFALL },
	};
}

/**
 * 将已校验的表单映射为保存请求。
 *
 * @returns 包含手记属性全量替换数据的请求，非踩坑类型显式清除踩坑信息
 */
export function noteToSaveRequest(values: NoteForm): NoteSaveRequest {
	const { type, project_id, pitfall } = values.journal;
	return {
		title: values.title.trim(),
		content_md: values.contentMD,
		tags: parseTagsText(values.tagsText),
		journal: { type, project_id, pitfall: type === "pitfall" ? pitfall : null },
	};
}

/** 逗号/中文逗号分隔的标签输入拆为数组（去空白去空项）。 */
export function parseTagsText(text: string): string[] {
	return text
		.split(/[,，]/)
		.map((t) => t.trim())
		.filter((t) => t.length > 0);
}
