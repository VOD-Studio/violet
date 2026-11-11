import manifest from "@violet/ui/component-manifest.json";
import { describe, expect, it } from "vitest";
import { EXHIBITS } from "../../ui/exhibits";
import { CASE_PADDING, caseColumnWidth, type Exhibit, exhibitStatus } from "../exhibit";

const Render = () => null;
const exhibit = (patch: Partial<Exhibit>): Exhibit => ({
	id: "sample",
	name: "示例",
	units: ["button"],
	zone: "shelf",
	category: "action",
	footprint: { width: 100, height: 100 },
	...patch,
});

describe("馆藏目录", () => {
	it("展品 id 唯一", () => {
		const ids = EXHIBITS.map((item) => item.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("每个 foundation 单元都有真实组件陈列", () => {
		const exhibited = new Set(
			EXHIBITS.filter((item) => item.Render).flatMap((item) => item.units),
		);
		const foundation = manifest.components
			.filter((unit) => unit.status === "foundation")
			.map((unit) => unit.name);
		expect(foundation.filter((name) => !exhibited.has(name))).toEqual([]);
	});

	it("待建展品都写明上架工单，已上架展品不再挂工单", () => {
		for (const item of EXHIBITS) {
			expect(item.issue !== undefined, item.id).toBe(item.Render === undefined);
		}
	});

	it("展品的状态 id 不重复", () => {
		for (const item of EXHIBITS) {
			const ids = (item.states ?? []).map((state) => state.id);
			expect(new Set(ids).size, item.id).toBe(ids.length);
		}
	});
});

describe("exhibitStatus", () => {
	it("没有真实组件即为待建", () => {
		expect(exhibitStatus(exhibit({ units: ["button"] }))).toBe("planned");
	});

	it("全部单元为 foundation 才算新架构", () => {
		expect(exhibitStatus(exhibit({ units: ["checkbox", "field"], Render }))).toBe("foundation");
	});

	it("清单外的单元属于站点组件", () => {
		expect(exhibitStatus(exhibit({ units: ["navbar"], Render }))).toBe("site");
	});
});

describe("caseColumnWidth", () => {
	it("取非整幅展品的最大占地加两侧柜内边距，整幅展品不参与", () => {
		const width = caseColumnWidth([
			exhibit({ footprint: { width: 300, height: 10 } }),
			exhibit({ zone: "content", footprint: { width: 520, height: 10 } }),
			exhibit({ zone: "banner", footprint: { width: 1120, height: 10 } }),
		]);
		expect(width).toBe(520 + CASE_PADDING * 2);
	});
});
