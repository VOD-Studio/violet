import { describe, expect, it } from "vitest";
import type { RoadmapItem } from "../model/roadmap";
import { contentOf } from "./roadmap-content";

const item = (overrides: Partial<RoadmapItem> = {}): RoadmapItem => ({
	id: "i1",
	project_id: "p",
	number: 1,
	title: "标题",
	description: "简介",
	stage: "planned",
	position: "a",
	tags: ["a"],
	links: [{ label: "PR", url: "https://example.com/pr" }],
	checklist: [{ text: "一步", done: true }],
	completion_date: null,
	delivered_version: "",
	blocked: false,
	created_at: "2026-10-01T00:00:00Z",
	updated_at: "2026-10-01T00:00:00Z",
	...overrides,
});

describe("contentOf", () => {
	it("取出可编辑的全部内容；未完成条目不带完成日期", () => {
		expect(contentOf(item())).toEqual({
			title: "标题",
			description: "简介",
			tags: ["a"],
			links: [{ label: "PR", url: "https://example.com/pr" }],
			checklist: [{ text: "一步", done: true }],
			delivered_version: "",
		});
	});

	it("已完成条目带上完成日期与交付版本，撤销时原样恢复", () => {
		expect(
			contentOf(
				item({
					stage: "completed",
					completion_date: "2026-10-01",
					delivered_version: "v1",
				}),
			),
		).toMatchObject({ completion_date: "2026-10-01", delivered_version: "v1" });
	});

	it("返回的是副本，改它不会改到缓存里的条目", () => {
		const source = item();
		const content = contentOf(source);
		content.tags.push("b");
		content.links[0].label = "改了";
		content.checklist[0].done = false;

		expect(source.tags).toEqual(["a"]);
		expect(source.links[0].label).toBe("PR");
		expect(source.checklist[0].done).toBe(true);
	});
});
