import type { PersonaAdminImage, PersonaFact } from "@entities/persona/model/types";

/** 本地编辑器为无后端 ID 的资料项补充稳定 React key。 */
export interface PersonaDraftFact extends PersonaFact {
	editor_key: string;
}

/** 后台编辑器的本地完整文档。 */
export interface PersonaDocument {
	name: string;
	subtitle: string;
	summary: string;
	content_md: string;
	facts: PersonaDraftFact[];
	images: PersonaAdminImage[];
}

/** 完整保存中的单张设定图输入。 */
export interface SavePersonaImageInput {
	file_id: string;
	caption: string;
	alt_text_override: string;
}

/** 人设档案完整保存输入。 */
export interface SavePersonaInput {
	expected_version: number;
	name: string;
	subtitle: string;
	summary: string;
	content_md: string;
	facts: PersonaFact[];
	images: SavePersonaImageInput[];
}

/** 激活与删除动作共用的乐观版本输入。 */
export interface PersonaVersionInput {
	expected_version: number;
}

/** 编辑文档相对服务端的保存状态。 */
export type PersonaSaveState = "saved" | "dirty" | "saving" | "error" | "conflict";
