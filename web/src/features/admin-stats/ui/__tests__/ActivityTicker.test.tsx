import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActivityTicker } from "../ActivityTicker";

const mockUseAdminAuditLogs = vi.fn();

vi.mock("@features/admin-audit-logs/api/queries", () => ({
	useAdminAuditLogs: () => mockUseAdminAuditLogs(),
}));

const mockAuditLogs = [
	{
		event_id: "evt-1",
		occurred_at: "2026-08-19T10:00:00Z",
		summary: "更新了系统配置",
		actor: { user_id: "u-1", user_name: "admin" },
		action: "update",
		resource: { type: "config", id: "1" },
	},
	{
		event_id: "evt-2",
		occurred_at: "2026-08-19T10:05:00Z",
		summary: "",
		actor: { user_id: "u-2", user_name: "editor" },
		action: "publish",
		resource: { type: "post", id: "p-1" },
	},
];

describe("ActivityTicker 最近活动轮播", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("无事件时展示 awaiting events 状态", () => {
		mockUseAdminAuditLogs.mockReturnValue({
			data: { data: [] },
			isLoading: false,
		});

		render(<ActivityTicker />);
		expect(screen.getByText("最近活动")).toBeTruthy();
		expect(screen.getByText(/awaiting events/)).toBeTruthy();
	});

	it("加载中时展示骨架占位", () => {
		mockUseAdminAuditLogs.mockReturnValue({
			data: undefined,
			isLoading: true,
		});

		const { container } = render(<ActivityTicker />);
		expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
	});

	it("内容未超出视口时，单份静态渲染，无多余副本且隐藏滚动条", () => {
		mockUseAdminAuditLogs.mockReturnValue({
			data: { data: mockAuditLogs },
			isLoading: false,
		});

		const { container } = render(<ActivityTicker />);
		expect(screen.getByText("最近活动")).toBeTruthy();
		expect(screen.getByText("live")).toBeTruthy();
		expect(screen.getByText("更新了系统配置")).toBeTruthy();
		expect(screen.getByText("editor publish post")).toBeTruthy();

		// 未超出视口时只渲染 1 份真实数据
		const uls = container.querySelectorAll("ul");
		expect(uls.length).toBe(1);
		expect(uls[0]?.getAttribute("aria-hidden")).toBeNull();

		// 彻底隐藏滚动条
		const scrollContainer = container.querySelector(".overflow-hidden");
		expect(scrollContainer).toBeTruthy();
	});

	it("内容超出视口时，启用克隆副本实现无缝循环，副本设置 aria-hidden", () => {
		mockUseAdminAuditLogs.mockReturnValue({
			data: { data: mockAuditLogs },
			isLoading: false,
		});

		const originalOffsetHeight = Object.getOwnPropertyDescriptor(
			HTMLElement.prototype,
			"offsetHeight",
		);
		const originalClientHeight = Object.getOwnPropertyDescriptor(
			HTMLElement.prototype,
			"clientHeight",
		);

		Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
			configurable: true,
			value: 400,
		});
		Object.defineProperty(HTMLElement.prototype, "clientHeight", {
			configurable: true,
			value: 160,
		});

		try {
			const { container } = render(<ActivityTicker />);
			const uls = container.querySelectorAll("ul");
			expect(uls.length).toBe(2);
			expect(uls[0]?.getAttribute("aria-hidden")).toBeNull();
			expect(uls[1]?.getAttribute("aria-hidden")).toBe("true");
		} finally {
			if (originalOffsetHeight) {
				Object.defineProperty(HTMLElement.prototype, "offsetHeight", originalOffsetHeight);
			}
			if (originalClientHeight) {
				Object.defineProperty(HTMLElement.prototype, "clientHeight", originalClientHeight);
			}
		}
	});
});
