import { describe, expect, it } from "vitest";
import type { OpenApiDoc } from "../model/types";
import {
	buildDocsModel,
	operationMatches,
	schemaRefName,
	schemaTypeName,
} from "./build-docs-model";

function makeDoc(paths: OpenApiDoc["paths"]): OpenApiDoc {
	return {
		openapi: "3.0.3",
		info: { title: "Violet API", version: "2.8.9" },
		paths,
		components: {
			schemas: {
				TweetDTO: { type: "object", properties: { id: { type: "string" } } },
			},
		},
	};
}

describe("buildDocsModel", () => {
	it("公开端点进正文、/admin 端点进附录，按 tag 聚合", () => {
		const model = buildDocsModel(
			makeDoc({
				"/posts": { get: { tags: ["文章"], summary: "文章列表" } },
				"/admin/posts": { post: { tags: ["文章管理"], summary: "创建文章" } },
			}),
		);
		expect(model.chapters).toHaveLength(1);
		expect(model.chapters[0].tag).toBe("文章");
		expect(model.appendix).toHaveLength(1);
		expect(model.appendix[0].tag).toBe("文章管理");
	});

	it("无 tag 的端点归入「未分组」", () => {
		const model = buildDocsModel(makeDoc({ "/x": { get: {} } }));
		expect(model.chapters[0].tag).toBe("未分组");
	});

	it("章按端点数降序、端点按路径字典序排列", () => {
		const model = buildDocsModel(
			makeDoc({
				"/b": { get: { tags: ["小章"], summary: "" } },
				"/a": {
					get: { tags: ["大章"], summary: "" },
					post: { tags: ["大章"], summary: "" },
				},
			}),
		);
		expect(model.chapters.map((c) => c.tag)).toEqual(["大章", "小章"]);
		expect(model.chapters[0].operations.map((o) => o.method)).toEqual(["GET", "POST"]);
	});

	it("同路径下方法按 GET→POST→PUT→PATCH→DELETE 排序", () => {
		const model = buildDocsModel(
			makeDoc({
				"/t": {
					delete: { tags: ["t"], summary: "" },
					get: { tags: ["t"], summary: "" },
					post: { tags: ["t"], summary: "" },
				},
			}),
		);
		expect(model.chapters[0].operations.map((o) => o.method)).toEqual([
			"GET",
			"POST",
			"DELETE",
		]);
	});
});

describe("operationMatches", () => {
	const op = {
		id: "GET /posts/{slug}",
		method: "GET",
		path: "/posts/{slug}",
		summary: "按 slug 获取文章",
		operation: {},
	};

	it("空查询全通过；命中 path/摘要/tag/方法", () => {
		expect(operationMatches(op, "文章", "")).toBe(true);
		expect(operationMatches(op, "文章", "slug")).toBe(true);
		expect(operationMatches(op, "文章", "获取")).toBe(true);
		expect(operationMatches(op, "文章", "文")).toBe(true);
		expect(operationMatches(op, "文章", "uploads")).toBe(false);
		expect(operationMatches(op, "文章", "get")).toBe(true);
	});
});

describe("schema helpers", () => {
	it("解 $ref 组件名；数组展开元素类型", () => {
		expect(schemaRefName({ $ref: "#/components/schemas/TweetDTO" })).toBe("TweetDTO");
		expect(schemaRefName({ $ref: "#/other/Path" })).toBeUndefined();
		expect(schemaRefName({ type: "string" })).toBeUndefined();
		expect(schemaTypeName({ type: "array", items: { type: "string" } })).toBe("string[]");
		expect(schemaTypeName({ type: "integer", format: "int64" })).toBe("integer(int64)");
		expect(schemaTypeName(undefined)).toBe("—");
	});
});
