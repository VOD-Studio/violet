import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Badge, BadgeAnchor } from "../badge";

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

describe("BadgeAnchor", () => {
	afterEach(cleanup);

	it("bottom-corner 将角标定位于右下角", () => {
		render(
			<BadgeAnchor placement="bottom-corner" badge={<Badge size="dot" variant="default" />}>
				<button type="button">头像</button>
			</BadgeAnchor>,
		);
		const anchor = screen.getByText("头像").parentElement;
		const badgeSlot = anchor?.querySelector('[aria-hidden="true"]');
		expect(badgeSlot?.classList.contains("bottom-0.5")).toBe(true);
		expect(badgeSlot?.classList.contains("translate-y-1/2")).toBe(true);
		expect(badgeSlot?.classList.contains("-translate-y-1/2")).toBe(false);
	});

	it("默认 corner 保持右上角定位", () => {
		render(
			<BadgeAnchor badge={<Badge size="dot" variant="default" />}>
				<button type="button">通知</button>
			</BadgeAnchor>,
		);
		const badgeSlot = screen
			.getByText("通知")
			.parentElement?.querySelector('[aria-hidden="true"]');
		expect(badgeSlot?.classList.contains("top-0.5")).toBe(true);
		expect(badgeSlot?.classList.contains("-translate-y-1/2")).toBe(true);
	});
});
