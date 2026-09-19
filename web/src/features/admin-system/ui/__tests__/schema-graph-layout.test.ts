import { describe, expect, it } from "vitest";
import type { DatabaseSchemaRelationshipDTO, DatabaseSchemaTableDTO } from "../../model/types";
import { buildSchemaGraphLayout } from "../schema-graph-layout";

const tables: DatabaseSchemaTableDTO[] = ["accounts", "posts", "comments", "settings"].map(
	(name) => ({ schema: "public", name, columns: [] }),
);

const relationships: DatabaseSchemaRelationshipDTO[] = [
	{
		name: "posts_author_fkey",
		source_schema: "public",
		source_table: "posts",
		source_columns: ["author_id"],
		target_schema: "public",
		target_table: "accounts",
		target_columns: ["id"],
		on_update: "NO ACTION",
		on_delete: "CASCADE",
	},
	{
		name: "comments_post_fkey",
		source_schema: "public",
		source_table: "comments",
		source_columns: ["post_id"],
		target_schema: "public",
		target_table: "posts",
		target_columns: ["id"],
		on_update: "NO ACTION",
		on_delete: "CASCADE",
	},
];

describe("schema graph layout", () => {
	it("未显示孤立表时只保留有真实关系的节点", () => {
		const layout = buildSchemaGraphLayout({
			tables,
			relationships,
			includeIsolated: false,
		});

		expect(layout.nodes.map((node) => node.key).sort()).toEqual([
			"public.accounts",
			"public.comments",
			"public.posts",
		]);
		expect(layout.relationships).toHaveLength(2);
		const repeated = buildSchemaGraphLayout({
			tables,
			relationships,
			includeIsolated: false,
		});
		const positions = layout.nodes.map(({ key, x, y }) => ({ key, x, y }));
		expect(positions).toEqual(repeated.nodes.map(({ key, x, y }) => ({ key, x, y })));
		expect(new Set(positions.map(({ x, y }) => `${x}:${y}`)).size).toBe(3);
		expect(positions.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);
	});
	it("聚焦表时只显示一跳关系并按外键方向分列", () => {
		const layout = buildSchemaGraphLayout({
			tables,
			relationships,
			includeIsolated: false,
			focusKey: "public.posts",
		});
		const xByKey = Object.fromEntries(layout.nodes.map((node) => [node.key, node.x]));

		expect(layout.nodes.map((node) => node.key).sort()).toEqual([
			"public.accounts",
			"public.comments",
			"public.posts",
		]);
		expect(layout.relationships).toHaveLength(2);
		expect(xByKey["public.comments"]).toBeLessThan(xByKey["public.posts"]);
		expect(xByKey["public.posts"]).toBeLessThan(xByKey["public.accounts"]);
	});

	it("全景模式按开关决定是否包含孤立表", () => {
		const connected = buildSchemaGraphLayout({
			tables,
			relationships,
			includeIsolated: false,
		});
		const all = buildSchemaGraphLayout({
			tables,
			relationships,
			includeIsolated: true,
		});

		expect(connected.nodes).toHaveLength(3);
		expect(all.nodes).toHaveLength(4);
	});
});
