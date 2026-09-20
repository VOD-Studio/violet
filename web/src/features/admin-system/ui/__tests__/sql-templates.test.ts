import { describe, expect, it } from "vitest";
import { LIST_TABLES_SQL } from "../sql-templates";

describe("LIST_TABLES_SQL", () => {
	it("使用 PostgreSQL 系统目录查询 public 表", () => {
		expect(LIST_TABLES_SQL).toContain("FROM pg_catalog.pg_tables");
		expect(LIST_TABLES_SQL).toContain("WHERE schemaname = 'public'");
		expect(LIST_TABLES_SQL).not.toMatch(/SHOW\s+TABLES/i);
	});
});
