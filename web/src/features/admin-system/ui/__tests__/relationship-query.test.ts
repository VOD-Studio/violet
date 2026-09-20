import { describe, expect, it } from "vitest";
import { buildRelationshipJoinSQL, buildTableSelectSQL } from "../relationship-query";

describe("buildRelationshipJoinSQL", () => {
	it("为复合外键生成带标识符转义的 JOIN", () => {
		const sql = buildRelationshipJoinSQL({
			name: "order_items_owner_fkey",
			source_schema: "public",
			source_table: 'order"items',
			source_columns: ["owner_id", "tenant_id"],
			target_schema: "public",
			target_table: "users",
			target_columns: ["id", "tenant_id"],
			on_update: "NO ACTION",
			on_delete: "CASCADE",
		});

		expect(sql).toBe(`SELECT src.*, ref.*
FROM "public"."order""items" AS src
JOIN "public"."users" AS ref
  ON src."owner_id" = ref."id"
 AND src."tenant_id" = ref."tenant_id"
LIMIT 100;`);
	});
});

describe("buildTableSelectSQL", () => {
	it("转义 schema 与表名后限制预览行数", () => {
		expect(
			buildTableSelectSQL({
				schema: "public",
				name: 'release"notes',
				columns: [],
			}),
		).toBe(`SELECT *
FROM "public"."release""notes"
LIMIT 100;`);
	});
});
