import { schemaRefName, schemaTypeName } from "../lib/build-docs-model";
import type { OpenApiSchema } from "../model/types";

interface SchemaFieldsProps {
	/** 待展开的 schema（通常是 $ref，或内联 object） */
	schema: OpenApiSchema | undefined;
	/** 全部组件 schema，用于解析 $ref */
	schemas: Record<string, OpenApiSchema>;
	/** 嵌套展开层级，超过后引用只显示组件名（防深递归爆版） */
	depth?: number;
}

/**
 * schema 属性表：字段名 / 类型 / 必填 / 说明。
 * 嵌套引用在深度内展开为缩进子表，超出后只显示组件名。
 */
export function SchemaFields({ schema, schemas, depth = 1 }: SchemaFieldsProps) {
	const resolved = resolveSchema(schema, schemas);
	const properties = resolved?.properties;
	if (!properties) {
		return <p className="font-mono text-xs text-paper-muted">{schemaTypeName(schema)}</p>;
	}
	const required = new Set(resolved?.required ?? []);
	return (
		<dl className="divide-y divide-paper-border/60">
			{Object.entries(properties).map(([name, field]) => (
				<div
					key={name}
					className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-4 gap-y-1 py-1.5"
				>
					<dt className="min-w-0 break-all font-mono text-xs leading-relaxed text-paper-foreground">
						{name}
						{required.has(name) ? (
							<span className="ml-0.5 text-red-700 dark:text-red-400" title="必填">
								*
							</span>
						) : null}
					</dt>
					<dd className="min-w-0 text-xs leading-relaxed">
						<span className="font-mono text-[11px] text-paper-muted">
							{schemaTypeName(field)}
							{field?.enum?.length ? ` · ${field.enum.join(" | ")}` : ""}
						</span>
						{field?.description ? (
							<p className="mt-0.5 text-paper-muted">{field.description}</p>
						) : null}
						{depth > 0 &&
						field &&
						(field.$ref || field.type === "object" || field.type === "array") ? (
							<SchemaFields schema={field} schemas={schemas} depth={depth - 1} />
						) : null}
					</dd>
				</div>
			))}
		</dl>
	);
}

/** 解一层 $ref；引用不存在时原样返回，由展示层兜底 */
function resolveSchema(
	schema: OpenApiSchema | undefined,
	schemas: Record<string, OpenApiSchema>,
): OpenApiSchema | undefined {
	const name = schemaRefName(schema);
	return (name && schemas[name]) || schema;
}
