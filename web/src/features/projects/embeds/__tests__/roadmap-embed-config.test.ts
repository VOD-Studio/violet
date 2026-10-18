import { describe, expect, it } from "vitest";
import { parseRoadmapEmbed } from "../roadmap-embed-config";

describe("roadmap 围栏参数", () => {
	it("卡片：省略 display 即 card，item 可选", () => {
		expect(parseRoadmapEmbed({ project: "kite" })).toEqual({
			project: "kite",
			display: "card",
		});
		expect(parseRoadmapEmbed({ project: "kite", item: 3, display: "card" })).toMatchObject({
			item: 3,
		});
	});

	it("画布：默认看板，关系图可以带 item 作根", () => {
		expect(parseRoadmapEmbed({ project: "kite", display: "canvas" })).toEqual({
			project: "kite",
			display: "canvas",
		});
		expect(
			parseRoadmapEmbed({ project: "kite", display: "canvas", view: "graph", item: 1 }),
		).toMatchObject({ view: "graph", item: 1 });
	});

	it("不合法：slug 格式、编号、未知字段、view 用在卡片上、看板画布带 item", () => {
		for (const input of [
			{ project: "Kite" },
			{ project: "kite", item: 0 },
			{ project: "kite", item: 1.5 },
			{ project: "kite", extra: true },
			{ project: "kite", display: "board" },
			{ project: "kite", view: "graph" },
			{ project: "kite", display: "canvas", item: 2 },
			{ project: "kite", display: "canvas", view: "tree" },
			"kite",
		])
			expect(parseRoadmapEmbed(input), JSON.stringify(input)).toBeNull();
	});
});
