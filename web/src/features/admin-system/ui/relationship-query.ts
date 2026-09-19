import type { DatabaseSchemaRelationshipDTO, DatabaseSchemaTableDTO } from "../model/types";

/** 根据外键列映射生成可直接执行的 PostgreSQL JOIN 查询。 */
export function buildRelationshipJoinSQL(relationship: DatabaseSchemaRelationshipDTO): string {
	const source = qualifiedName(relationship.source_schema, relationship.source_table);
	const target = qualifiedName(relationship.target_schema, relationship.target_table);
	const conditions = relationship.source_columns
		.map(
			(column, index) =>
				`src.${quoteIdentifier(column)} = ref.${quoteIdentifier(relationship.target_columns[index] ?? column)}`,
		)
		.join("\n AND ");

	return `SELECT src.*, ref.*
FROM ${source} AS src
JOIN ${target} AS ref
  ON ${conditions}
LIMIT 100;`;
}

/** 为所选表生成安全转义的预览查询。 */
export function buildTableSelectSQL(table: DatabaseSchemaTableDTO): string {
	return `SELECT *
FROM ${qualifiedName(table.schema, table.name)}
LIMIT 100;`;
}

function qualifiedName(schema: string, table: string): string {
	return `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
}

function quoteIdentifier(identifier: string): string {
	return `"${identifier.replaceAll('"', '""')}"`;
}
