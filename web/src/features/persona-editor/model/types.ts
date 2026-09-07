import type {
	PersonaAdminAsset,
	PersonaAdminImage,
	PersonaFact,
} from "@entities/persona/model/types";

/** 本地编辑器为无后端 ID 的资料项补充稳定 React key。 */
export interface PersonaDraftFact extends PersonaFact {
	editor_key: string;
}

/** 后台编辑器中的一个语言版本。 */
export interface PersonaDraftLocalization {
	locale: string;
	name: string;
	subtitle: string;
	summary: string;
	content_md: string;
	content_html: string;
	facts: PersonaDraftFact[];
	images: PersonaAdminImage[];
	is_complete: boolean;
}

/** 后台编辑器持有的完整多语言文档。 */
export interface PersonaDocument {
	default_locale: string;
	avatar: PersonaAdminAsset | null;
	localizations: PersonaDraftLocalization[];
}

/** 完整保存中的单张设定图输入。 */
export interface SavePersonaImageInput {
	file_id: string;
	caption: string;
	alt_text_override: string;
}

/** 完整保存中的单个语言版本。 */
export interface SavePersonaLocalizationInput {
	locale: string;
	name: string;
	subtitle: string;
	summary: string;
	content_md: string;
	facts: PersonaFact[];
	images: SavePersonaImageInput[];
}

/** 人设档案完整保存输入。 */
export interface SavePersonaInput {
	expected_version: number;
	default_locale: string;
	/** 空串表示清除草稿头像。 */
	avatar_file_id: string;
	localizations: SavePersonaLocalizationInput[];
}

/** 激活与删除动作共用的乐观版本输入。 */
export interface PersonaVersionInput {
	expected_version: number;
}

/** 编辑文档相对服务端的保存状态。 */
export type PersonaSaveState = "saved" | "dirty" | "saving" | "error" | "conflict";
