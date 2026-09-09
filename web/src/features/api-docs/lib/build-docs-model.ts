import type {
	DocChapter,
	DocOperation,
	DocsModel,
	OpenApiDoc,
	OpenApiOperation,
	OpenApiSchema,
} from "../model/types";

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"] as const;
const METHOD_ORDER: Record<string, number> = { get: 0, post: 1, put: 2, patch: 3, delete: 4 };

/**
 * 把 OpenAPI 文档归并为「正文 + 附录」两册的渲染模型：
 * 公开端点按 tag 分章为正文，/admin/* 端点归入附录（管理界面）。
 */
export function buildDocsModel(doc: OpenApiDoc): DocsModel {
	const chapters = new Map<string, DocOperation[]>();
	const appendix = new Map<string, DocOperation[]>();

	for (const [path, item] of Object.entries(doc.paths ?? {})) {
		for (const method of HTTP_METHODS) {
			const op = item?.[method];
			if (!op) continue;
			const entry = toDocOperation(method, path, op);
			const tag = pickTag(op);
			const target = path.startsWith("/admin") ? appendix : chapters;
			const list = target.get(tag) ?? [];
			list.push(entry);
			target.set(tag, list);
		}
	}

	const sortChapters = (m: Map<string, DocOperation[]>): DocChapter[] =>
		[...m.entries()]
			.map(([tag, operations]) => ({
				tag,
				operations: sortOperations(operations),
			}))
			.sort(
				(a, b) =>
					b.operations.length - a.operations.length || a.tag.localeCompare(b.tag, "zh"),
			);

	return {
		title: doc.info?.title ?? "API",
		version: doc.info?.version ?? "",
		description: doc.info?.description ?? "",
		chapters: sortChapters(chapters),
		appendix: sortChapters(appendix),
		schemas: doc.components?.schemas ?? {},
	};
}

function pickTag(op: OpenApiOperation): string {
	return op.tags?.[0] ?? "未分组";
}

function toDocOperation(method: string, path: string, op: OpenApiOperation): DocOperation {
	return {
		id: `${method.toUpperCase()} ${path}`,
		method: method.toUpperCase(),
		path,
		summary: op.summary ?? "",
		description: op.description,
		operation: op,
	};
}

function sortOperations(ops: DocOperation[]): DocOperation[] {
	return [...ops].sort(
		(a, b) =>
			a.path.localeCompare(b.path) ||
			(METHOD_ORDER[a.method.toLowerCase()] ?? 9) -
				(METHOD_ORDER[b.method.toLowerCase()] ?? 9),
	);
}

/**
 * 关键字过滤：命中 path、摘要或所属 tag（大小写不敏感）。
 */
export function operationMatches(op: DocOperation, tag: string, query: string): boolean {
	const q = query.trim().toLowerCase();
	if (!q) return true;
	return (
		op.path.toLowerCase().includes(q) ||
		op.summary.toLowerCase().includes(q) ||
		tag.toLowerCase().includes(q) ||
		op.method.toLowerCase() === q
	);
}

/**
 * 解出 $ref 指向的 schema 名（"#/components/schemas/X" → "X"）；
 * 非引用或引用不在 components.schemas 下返回 undefined。
 */
export function schemaRefName(schema: OpenApiSchema | undefined): string | undefined {
	if (!schema?.$ref) return undefined;
	return schema.$ref.startsWith("#/components/schemas/")
		? (schema.$ref.slice("#/components/schemas/".length) ?? undefined)
		: undefined;
}

/**
 * schema 的展示类型名：引用用组件名，数组带 []，其余用 type/format。
 */
export function schemaTypeName(schema: OpenApiSchema | undefined): string {
	if (!schema) return "—";
	const ref = schemaRefName(schema);
	if (ref) return ref;
	if (schema.type === "array") return `${schemaTypeName(schema.items)}[]`;
	const base = schema.type ?? "object";
	return schema.format ? `${base}(${schema.format})` : base;
}
