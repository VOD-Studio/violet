import { describe, expect, it } from "vitest";
import type { RuntimeLogFilter } from "../../model/types";
import { buildRuntimeLogExportURL, buildRuntimeLogStreamURL } from "../client";

const filters: RuntimeLogFilter = {
	levels: ["warn", "error"],
	source: "http",
	keyword: "timeout",
	request_id: "request-1",
	trace_id: "trace-1",
	from: "2026-09-12T01:02:03.000Z",
	until: "2026-09-12T04:05:06.000Z",
};

describe("runtime log delivery URLs", () => {
	it("实时流与导出共享筛选且 URL 不携带身份令牌", () => {
		const stream = new URL(buildRuntimeLogStreamURL(filters, "42"), "https://violet.test");
		const exported = new URL(buildRuntimeLogExportURL(filters), "https://violet.test");

		expect(stream.pathname).toBe("/api/v1/admin/runtime-logs/stream");
		expect(exported.pathname).toBe("/api/v1/admin/runtime-logs/export");
		expect(stream.searchParams.get("after")).toBe("42");
		stream.searchParams.delete("after");
		expect(stream.searchParams.toString()).toBe(exported.searchParams.toString());
		expect(stream.search).not.toMatch(/token|session|credential/i);
		expect(exported.search).not.toMatch(/token|session|credential/i);
	});
});
