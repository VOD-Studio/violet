import type { PageQuery } from "@shared/api/types";

/** 一条有序角色资料。 */
export interface PersonaFact {
	label: string;
	value: string;
}

/** 后台共享头像投影。 */
export interface PersonaAdminAsset {
	file_id: string;
	url: string;
	thumbnail: string;
	mime_type: string;
	width: number;
	height: number;
	alt_text: string;
}

/** 后台设定图投影。数组顺序决定公开展示顺序。 */
export interface PersonaAdminImage extends PersonaAdminAsset {
	caption: string;
	/** 素材库提供的默认替代文本。 */
	alt_text: string;
	/** 空串表示沿用素材库替代文本。 */
	alt_text_override: string;
}

/** 公开页共享头像投影，不暴露素材 ID。 */
export interface PersonaPublicAsset {
	url: string;
	thumbnail: string;
	width: number;
	height: number;
	alt_text: string;
}

/** 公开页设定图投影，不暴露素材 ID。 */
export interface PersonaPublicImage extends PersonaPublicAsset {
	caption: string;
}

/** 后台单个语言版本的完整投影。 */
export interface PersonaLocalization {
	/** 规范化后的 BCP 47 语言代码。 */
	locale: string;
	name: string;
	subtitle: string;
	summary: string;
	content_md: string;
	content_html: string;
	facts: PersonaFact[];
	images: PersonaAdminImage[];
	is_complete: boolean;
}

/** 后台完整人设档案。 */
export interface PersonaDetail {
	id: string;
	created_by: string;
	default_locale: string;
	/** 草稿尚未配置头像时为 null。 */
	avatar: PersonaAdminAsset | null;
	localizations: PersonaLocalization[];
	is_active: boolean;
	is_complete: boolean;
	version: number;
	/** RFC3339。 */
	created_at: string;
	/** RFC3339。 */
	updated_at: string;
}

/** 后台档案列表项。 */
export interface PersonaSummary {
	id: string;
	name: string;
	subtitle: string;
	summary: string;
	/** 已配置语言代码，默认语言排第一。 */
	locales: string[];
	fact_count: number;
	image_count: number;
	is_active: boolean;
	is_complete: boolean;
	version: number;
	/** RFC3339。 */
	created_at: string;
	/** RFC3339。 */
	updated_at: string;
}

/** 当前公开人设；服务端已协商语言并把正文渲染为安全 HTML。 */
export interface PublicPersona {
	/** 本次实际返回的语言。 */
	locale: string;
	default_locale: string;
	/** 仅包含具备完整公开资料的语言版本。 */
	available_locales: string[];
	avatar: PersonaPublicAsset;
	name: string;
	subtitle: string;
	summary: string;
	content_html: string;
	facts: PersonaFact[];
	images: PersonaPublicImage[];
}

/** 后台档案列表查询。 */
export interface PersonaListQuery extends PageQuery {
	q?: string;
}
