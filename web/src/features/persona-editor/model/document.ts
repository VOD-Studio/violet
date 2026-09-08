import type { MediaFile } from "@entities/media/model/types";
import type {
	PersonaAdminAsset,
	PersonaAdminImage,
	PersonaDetail,
} from "@entities/persona/model/types";
import type {
	PersonaDocument,
	PersonaDraftFact,
	PersonaDraftLocalization,
	SavePersonaInput,
} from "@features/persona-editor/model/types";
import type { CompleteUploadResult } from "@features/upload/model/types";

export const MAX_PERSONA_LOCALES = 8;
export const MAX_PERSONA_FACTS = 24;
export const MAX_PERSONA_IMAGES = 30;

let nextFactKey = 0;

export interface PersonaCompletenessItem {
	id: "avatar" | "name" | "summary" | "content" | "image";
	label: string;
	complete: boolean;
}

/** 把后台详情收敛为编辑器持有的完整多语言文档。 */
export function toPersonaDocument(detail: PersonaDetail): PersonaDocument {
	return {
		default_locale: detail.default_locale,
		avatar: detail.avatar,
		localizations: detail.localizations.map((localization) => ({
			...localization,
			facts: localization.facts.map((fact, index) => ({
				...fact,
				editor_key: `${detail.id}:${localization.locale}:fact:${index}`,
			})),
		})),
	};
}

/** 把本地文档投影为服务端全量保存输入。 */
export function buildSavePersonaInput(
	expectedVersion: number,
	document: PersonaDocument,
): SavePersonaInput {
	return {
		expected_version: expectedVersion,
		default_locale: document.default_locale,
		avatar_file_id: document.avatar?.file_id ?? "",
		localizations: document.localizations.map((localization) => ({
			locale: localization.locale,
			name: localization.name,
			subtitle: localization.subtitle,
			summary: localization.summary,
			content_md: localization.content_md,
			facts: localization.facts.map(({ label, value }) => ({ label, value })),
			images: localization.images.map((image) => ({
				file_id: image.file_id,
				caption: image.caption,
				alt_text_override: image.alt_text_override,
			})),
		})),
	};
}

/** 返回指定语言版本；调用方应在删除或切换语言后重新解析。 */
export function findPersonaLocalization(
	document: PersonaDocument,
	locale: string,
): PersonaDraftLocalization | undefined {
	return document.localizations.find((localization) => localization.locale === locale);
}

/** 只替换指定语言，保留其余语言与全局字段引用。 */
export function updatePersonaLocalization(
	document: PersonaDocument,
	locale: string,
	updater: (localization: PersonaDraftLocalization) => PersonaDraftLocalization,
): PersonaDocument {
	let changed = false;
	const localizations = document.localizations.map((localization) => {
		if (localization.locale !== locale) return localization;
		const next = updater(localization);
		changed ||= next !== localization;
		return next;
	});
	return changed ? { ...document, localizations } : document;
}

/** 新建一个待补全的语言版本。 */
export function createPersonaLocalization(locale: string): PersonaDraftLocalization {
	return {
		locale,
		name: "",
		subtitle: "",
		summary: "",
		content_md: "",
		content_html: "",
		facts: [],
		images: [],
		is_complete: false,
	};
}

/** 返回激活所需头像与默认语言资料的当前完成状态。 */
export function getPersonaCompleteness(
	localization: PersonaDraftLocalization,
	avatar: PersonaAdminAsset | null,
): PersonaCompletenessItem[] {
	return [
		{ id: "avatar", label: "角色头像", complete: Boolean(avatar) },
		{ id: "name", label: "角色名称", complete: localization.name.trim().length > 0 },
		{ id: "summary", label: "身份简介", complete: localization.summary.trim().length > 0 },
		{
			id: "content",
			label: "设定正文",
			complete: localization.content_md.trim().length > 0,
		},
		{ id: "image", label: "至少一张设定图", complete: localization.images.length > 0 },
	];
}

/** 校验完整多语言文档中无法由输入控件单独表达的边界。 */
export function validatePersonaDocument(document: PersonaDocument): string | null {
	if (
		document.localizations.length === 0 ||
		document.localizations.length > MAX_PERSONA_LOCALES
	) {
		return "人设档案需要保留 1 至 8 个语言版本";
	}
	if (!document.localizations.some(({ locale }) => locale === document.default_locale)) {
		return "默认语言必须对应一个已配置的语言版本";
	}
	const locales = new Set<string>();
	for (const localization of document.localizations) {
		if (locales.has(localization.locale)) return `语言版本「${localization.locale}」重复`;
		locales.add(localization.locale);
		const localizationError = validateLocalization(localization);
		if (localizationError) return `${localization.locale}：${localizationError}`;
	}
	return null;
}

function validateLocalization(localization: PersonaDraftLocalization): string | null {
	const unicodeLength = (value: string) => Array.from(value).length;
	if (unicodeLength(localization.name) > 120) return "角色名称不能超过 120 个字符";
	if (unicodeLength(localization.subtitle) > 240) return "角色定位不能超过 240 个字符";
	if (unicodeLength(localization.summary) > 500) return "身份简介不能超过 500 个字符";
	if (localization.facts.length > MAX_PERSONA_FACTS) return "资料项最多包含 24 项";
	if (localization.images.length > MAX_PERSONA_IMAGES) return "设定图最多包含 30 张";

	const labels = new Set<string>();
	for (const fact of localization.facts) {
		const label = fact.label.trim();
		if (!label || !fact.value.trim()) return "每条资料项都需要填写名称和内容";
		if (unicodeLength(fact.label) > 40) return "资料项名称不能超过 40 个字符";
		if (unicodeLength(fact.value) > 300) return "资料项内容不能超过 300 个字符";
		if (labels.has(label)) return `资料项名称「${label}」重复`;
		labels.add(label);
	}

	const fileIds = new Set<string>();
	for (const image of localization.images) {
		if (fileIds.has(image.file_id)) return "同一素材不能重复加入一个语言版本的设定图";
		fileIds.add(image.file_id);
		if (unicodeLength(image.caption) > 500) return "图片说明不能超过 500 个字符";
		if (unicodeLength(image.alt_text_override) > 300) {
			return "图片替代文本不能超过 300 个字符";
		}
	}
	return null;
}

/** 把素材库文件投影为尚未保存的头像。 */
export function mediaFileToPersonaAvatar(file: MediaFile): PersonaAdminAsset {
	return {
		file_id: file.id,
		url: file.url,
		thumbnail: file.thumbnail,
		mime_type: file.mime_type,
		width: 0,
		height: 0,
		alt_text: file.alt_text ?? "",
	};
}

/** 追加未重复的素材库图片，并遵守 30 张上限。 */
export function appendPersonaMedia(
	images: PersonaAdminImage[],
	files: MediaFile[],
): PersonaAdminImage[] {
	const known = new Set(images.map((image) => image.file_id));
	const additions: PersonaAdminImage[] = [];
	for (const file of files) {
		if (!file.mime_type.startsWith("image/") || known.has(file.id)) continue;
		known.add(file.id);
		additions.push({
			file_id: file.id,
			url: file.url,
			thumbnail: file.thumbnail,
			mime_type: file.mime_type,
			width: 0,
			height: 0,
			caption: "",
			alt_text: file.alt_text ?? "",
			alt_text_override: "",
		});
		if (images.length + additions.length >= MAX_PERSONA_IMAGES) break;
	}
	return additions.length > 0 ? [...images, ...additions] : images;
}

/** 把刚上传完成的图片追加到本地文档。 */
export function appendUploadedPersonaImage(
	images: PersonaAdminImage[],
	uploaded: CompleteUploadResult,
	source: File,
): PersonaAdminImage[] {
	if (
		!source.type.startsWith("image/") ||
		images.some((image) => image.file_id === uploaded.file_id) ||
		images.length >= MAX_PERSONA_IMAGES
	) {
		return images;
	}
	return [
		...images,
		{
			file_id: uploaded.file_id,
			url: uploaded.url,
			thumbnail: uploaded.thumbnail ?? "",
			mime_type: source.type,
			width: uploaded.width ?? 0,
			height: uploaded.height ?? 0,
			caption: "",
			alt_text: "",
			alt_text_override: "",
		},
	];
}

/** 新建一条空资料项。 */
export function createPersonaFact(): PersonaDraftFact {
	nextFactKey += 1;
	return { editor_key: `new-fact-${nextFactKey}`, label: "", value: "" };
}
