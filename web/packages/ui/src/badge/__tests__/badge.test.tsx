import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Badge } from "../badge";

describe("Badge", () => {
	afterEach(cleanup);

	it("link 规格取消默认水平内边距，且调用方颜色覆盖配方", () => {
		render(
			<Badge variant="link" className="text-destructive">
				查看详情
			</Badge>,
		);
		const badge = screen.getByText("查看详情");
		expect(badge.classList.contains("px-0")).toBe(true);
		expect(badge.classList.contains("px-2")).toBe(false);
		expect(badge.classList.contains("text-destructive")).toBe(true);
		expect(badge.classList.contains("text-primary")).toBe(false);
	});

	it("非默认尺寸不触发 link 的内边距组合规则", () => {
		render(
			<Badge variant="link" size="count">
				12
			</Badge>,
		);
		const badge = screen.getByText("12");
		expect(badge.classList.contains("px-1")).toBe(true);
		expect(badge.classList.contains("px-0")).toBe(false);
	});
});
