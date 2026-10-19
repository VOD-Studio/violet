import { describe, expect, it } from "vitest";
import type { RoadmapItem, RoadmapRelation, RoadmapRelationType } from "../model/roadmap";
import { RELATION_KINDS, relationGroups, relationInput } from "./roadmap-relations";

const item = (id: string): RoadmapItem => ({
	id,
	project_id: "p",
	number: Number(id.replace(/\D/g, "")) || 1,
	title: id,
	description: "",
	stage: "planned",
	position: id,
	tags: [],
	links: [],
	checklist: [],
	completion_date: null,
	delivered_version: "",
	blocked: false,
	created_at: "2026-10-01T00:00:00Z",
	updated_at: "2026-10-01T00:00:00Z",
});
const relation = (source: string, target: string, type: RoadmapRelationType): RoadmapRelation => ({
	id: `${source}-${type}-${target}`,
	project_id: "p",
	source_id: source,
	target_id: target,
	type,
	created_at: "2026-10-01T00:00:00Z",
});
const items = ["a1", "b2", "c3", "d4"].map(item);

describe("relationGroups", () => {
	it("按「被阻塞、阻塞、扩展、被扩展、修复、被修复」的顺序，只列有关系的类别", () => {
		const groups = relationGroups("b2", items, [
			relation("b2", "c3", "fixes"),
			relation("d4", "b2", "extends"),
			relation("a1", "b2", "blocks"),
			relation("b2", "d4", "blocks"),
		]);

		expect(
			groups.map((group) => [group.label, group.entries.map((entry) => entry.item.id)]),
		).toEqual([
			["被阻塞", ["a1"]],
			["阻塞", ["d4"]],
			["被扩展", ["d4"]],
			["修复", ["c3"]],
		]);
	});

	it("同一类别的多个条目按关系的先后排列", () => {
		const groups = relationGroups("a1", items, [
			relation("a1", "d4", "blocks"),
			relation("a1", "b2", "blocks"),
		]);

		expect(groups[0].entries.map((entry) => entry.item.id)).toEqual(["d4", "b2"]);
		expect(groups[0].entries.map((entry) => entry.relation.id)).toEqual([
			"a1-blocks-d4",
			"a1-blocks-b2",
		]);
	});

	it("另一端不在条目里的关系（例如已删除的条目）不列出，整个类别也随之消失", () => {
		expect(relationGroups("a1", [items[0]], [relation("a1", "ghost", "blocks")])).toEqual([]);
	});

	it("与这个条目无关的关系不算，没有关系就是空的", () => {
		expect(relationGroups("a1", items, [relation("b2", "c3", "blocks")])).toEqual([]);
		expect(relationGroups("a1", items, [])).toEqual([]);
	});
});

describe("relationInput", () => {
	const kind = (key: string) => {
		const found = RELATION_KINDS.find((entry) => entry.key === key);
		if (!found) throw new Error(`unknown relation kind ${key}`);
		return found;
	};

	it("这个条目是来源时连出去，是目标时连进来", () => {
		expect(relationInput("a1", kind("blocks:out"), "b2")).toEqual({
			source_id: "a1",
			target_id: "b2",
			type: "blocks",
		});
		expect(relationInput("a1", kind("blocks:in"), "b2")).toEqual({
			source_id: "b2",
			target_id: "a1",
			type: "blocks",
		});
		expect(relationInput("a1", kind("fixes:in"), "b2")).toMatchObject({ type: "fixes" });
	});
});
