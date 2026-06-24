import { type CmdItem, filterCommands } from "@shared/lib/hooks/cmd-filter";
import { describe, expect, it } from "vitest";

const items: CmdItem[] = [
	{ id: "1", label: "首页", group: "nav", keywords: ["home"], run: () => {} },
	{ id: "2", label: "博客", group: "nav", keywords: ["blog"], run: () => {} },
	{
		id: "3",
		label: "切换暗色",
		group: "theme",
		keywords: ["dark"],
		run: () => {},
	},
	{
		id: "4",
		label: "切换亮色",
		group: "theme",
		keywords: ["light"],
		run: () => {},
	},
];

describe("filterCommands", () => {
	it("returns all on empty query", () => {
		expect(filterCommands(items, "")).toHaveLength(4);
	});

	it("substring matches label case-insensitive", () => {
		expect(filterCommands(items, "首")).toHaveLength(1);
	});

	it("matches keywords", () => {
		expect(filterCommands(items, "dark")).toHaveLength(1);
		expect(filterCommands(items, "dark")[0].id).toBe("3");
	});

	it("command mode filters by group", () => {
		expect(filterCommands(items, "> theme")).toHaveLength(2);
	});

	it("command mode with empty group returns all", () => {
		expect(filterCommands(items, ">")).toHaveLength(4);
	});

	it("no match returns empty", () => {
		expect(filterCommands(items, "zzz")).toHaveLength(0);
	});
});
