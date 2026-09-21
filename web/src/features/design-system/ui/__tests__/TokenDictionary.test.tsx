import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../model/probe", () => ({
	readTokenValue: (_varName: string, domain: string) => ({
		raw: domain === "dark" ? "oklch(0.9 0.1 286)" : "oklch(0.5 0.2 286)",
		hex: "#123456",
	}),
}));

import { TokenDictionary } from "../TokenDictionary";

describe("token 词典", () => {
	it("六个分组齐备", () => {
		render(<TokenDictionary />);
		for (const title of ["语义色", "品牌色", "纸面", "材质遗留", "图表色", "霓虹色"]) {
			expect(screen.getByRole("region", { name: title })).toBeTruthy();
		}
	});

	it("陈列车 45 个 token，双域色值各一格", () => {
		render(<TokenDictionary />);
		expect(screen.getAllByText("#123456 · #123456")).toHaveLength(45);
		expect(screen.getByText("--background")).toBeTruthy();
		expect(screen.queryByText("—")).toBeNull();
	});
});
