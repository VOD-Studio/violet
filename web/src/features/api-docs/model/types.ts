/**
 * OpenAPI 3.0 文档的渲染子集类型。
 *
 * 只声明文档页实际消费的字段；OpenAPI 全集远大于此，
 * 未声明的字段由 fetch 的 JSON 原样携带、渲染层忽略。
 */

/** schema 引用（#/components/schemas/X）或内联 schema 的联合形态 */
export interface OpenApiSchema {
	$ref?: string;
	type?: string;
	format?: string;
	description?: string;
	nullable?: boolean;
	required?: string[];
	enum?: (string | number)[];
	default?: unknown;
	/** object 的属性表 */
	properties?: Record<string, OpenApiSchema>;
	/** array 的元素 schema */
	items?: OpenApiSchema;
}

export interface OpenApiParameter {
	name: string;
	in: string;
	required?: boolean;
	description?: string;
	schema?: OpenApiSchema;
}

export interface OpenApiOperation {
	tags?: string[];
	summary?: string;
	description?: string;
	parameters?: OpenApiParameter[];
	requestBody?: {
		required?: boolean;
		description?: string;
		content?: Record<string, { schema?: OpenApiSchema }>;
	};
	responses?: Record<
		string,
		{ description?: string; content?: Record<string, { schema?: OpenApiSchema }> }
	>;
}

/** 单个 path 下的方法 → 操作映射（get/post/put/patch/delete） */
export type OpenApiPathItem = Record<string, OpenApiOperation | undefined>;

export interface OpenApiDoc {
	openapi: string;
	info: {
		title: string;
		version: string;
		description?: string;
	};
	paths: Record<string, OpenApiPathItem>;
	components?: {
		schemas?: Record<string, OpenApiSchema>;
	};
}

// ============ 文档页渲染模型（build-docs-model 的产物） ============

/** 单个端点条目（方法 + 路径 + 原始操作） */
export interface DocOperation {
	id: string;
	method: string;
	path: string;
	summary: string;
	description?: string;
	operation: OpenApiOperation;
}

/** 按 tag 聚合的一章端点 */
export interface DocChapter {
	tag: string;
	operations: DocOperation[];
}

/** 「正文（公开端点）+ 附录（管理端点）」双册渲染模型 */
export interface DocsModel {
	title: string;
	version: string;
	description: string;
	chapters: DocChapter[];
	appendix: DocChapter[];
	schemas: Record<string, OpenApiSchema>;
}
