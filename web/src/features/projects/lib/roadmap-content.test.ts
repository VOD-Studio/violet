import { describe, expect, it } from "vitest";
import type { RoadmapItem } from "../model/roadmap";
import { contentFromDraft, contentOf, draftOf } from "./roadmap-content";

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

describe("draftOf 与 contentFromDraft", () => {
	it("草稿原样还原成条目当前的内容", () => {
		const source = item({ tags: ["a", "b"] });

		expect(contentFromDraft(draftOf(source), source)).toEqual(contentOf(source));
	});

	it("整理草稿：去空白、丢空行、标签按各种逗号与换行拆开并去重", () => {
		const source = item();
		const content = contentFromDraft(
			{
				title: "  新标题 ",
				description: "  一段说明\n第二行  ",
				tags: "前端，后端,  前端、文档\n测试 ",
				links: [
					{ label: " 设计稿 ", url: " https://example.com/design " },
					{ label: "没有地址", url: "  " },
				],
				checklist: [
					{ text: " 第一步 ", done: true },
					{ text: "   ", done: false },
				],
				deliveredVersion: "v9",
				completionDate: "2026-10-30",
			},
			source,
		);

		expect(content).toEqual({
			title: "新标题",
			description: "一段说明\n第二行",
			tags: ["前端", "后端", "文档", "测试"],
			links: [{ label: "设计稿", url: "https://example.com/design" }],
			checklist: [{ text: "第一步", done: true }],
			delivered_version: "",
		});
	});

	it("已完成条目带上交付版本与完成日期；日期留空时不带，后端保留原值", () => {
		const done = item({ stage: "completed", completion_date: "2026-10-01" });
		const draft = {
			...draftOf(done),
			deliveredVersion: " v2.0.0 ",
			completionDate: "2026-10-05",
		};

		expect(contentFromDraft(draft, done)).toMatchObject({
			delivered_version: "v2.0.0",
			completion_date: "2026-10-05",
		});
		expect(contentFromDraft({ ...draft, completionDate: "" }, done)).not.toHaveProperty(
			"completion_date",
		);
	});
});
