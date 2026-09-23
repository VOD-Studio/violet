import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MotionCharter } from "../MotionCharter";

describe("动效章程", () => {
	it("呈现四职责与三律法", () => {
		render(<MotionCharter />);
		expect(screen.getByText("壹 · 反馈")).toBeTruthy();
		expect(screen.getByText("贰 · 浮现")).toBeTruthy();
		expect(screen.getByText("叁 · 流动")).toBeTruthy();
		expect(screen.getByText("肆 · 氛围")).toBeTruthy();
		expect(screen.getByText("合成层律")).toBeTruthy();
		expect(screen.getByText("场景律")).toBeTruthy();
		expect(screen.getByText("快进快出律")).toBeTruthy();
		// 旧红线不再出现
		expect(screen.queryByText(/非必要不使用缩放/)).toBeNull();
	});

	it("场景全覆盖：反馈、浮现、流动与折叠", () => {
		render(<MotionCharter />);
		for (const label of [
			"反馈 · 悬停按压",
			"反馈 · 链接热线",
			"反馈 · 成功警示",
			"浮现 · 气泡提示",
			"浮现 · 弹出游层",
			"浮现 · 模态对话框",
			"浮现 · 抽屉侧栏",
			"浮现 · 骨架屏交接",
			"流动 · 状态切换",
			"流动 · 列表重排",
			"流动 · 数字滚动",
			"流动 · 滚动显现",
			"展开折叠",
		]) {
			expect(screen.getByText(label)).toBeTruthy();
		}
	});

	it("链接热线样例可点击且底线动画走 transform", () => {
		render(<MotionCharter />);
		const link = screen.getByRole("button", { name: "正文内链 · 悬停看底线生长" });
		expect(link.className).toContain("after:scale-x-0");
		expect(link.className).toContain("after:transition-transform");
		fireEvent.click(link);
		expect(screen.getByText("feed")).toBeTruthy();
	});

	it("成功警示样例可触发摇晃与 Toast", () => {
		render(<MotionCharter />);
		fireEvent.click(screen.getByRole("button", { name: "触发警示摇晃" }));
		expect(screen.getByText("输入不合法，请检查后重试")).toBeTruthy();
		// Toast 走全局 sonner（jsdom 无 Toaster 容器），触发不抛错即为通过
		expect(() =>
			fireEvent.click(screen.getByRole("button", { name: "触发 Toast 通知" })),
		).not.toThrow();
	});

	it("列表重排样例支持删除与还原", async () => {
		render(<MotionCharter />);
		fireEvent.click(screen.getByRole("button", { name: "移除 设计原则" }));
		// 条目进入 exit 动画，删除控件随状态立即消失
		await waitFor(() => {
			expect(screen.queryByRole("button", { name: "移除 设计原则" })).toBeNull();
		});
		expect(screen.getByRole("button", { name: "移除 快速决策表" })).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "还原" }));
		await waitFor(() => {
			expect(screen.getByRole("button", { name: "移除 设计原则" })).toBeTruthy();
		});
	});

	it("数字滚动样例可变更数值", () => {
		render(<MotionCharter />);
		// 初始动画未推进时为 0，但等宽数字容器存在
		const counter = document.querySelector(".tabular-nums");
		expect(counter).toBeTruthy();
		expect(() =>
			fireEvent.click(screen.getByRole("button", { name: "变更数值" })),
		).not.toThrow();
	});

	it("气泡与游层样例渲染触发控件", () => {
		render(<MotionCharter />);
		expect(screen.getByRole("button", { name: "上方气泡" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "打开 Popover" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "打开菜单" })).toBeTruthy();
	});

	it("模态与抽屉样例渲染触发控件", () => {
		render(<MotionCharter />);
		expect(screen.getByRole("button", { name: "打开对话框" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "打开右侧抽屉" })).toBeTruthy();
	});

	it("折叠样例可展开收起", () => {
		render(<MotionCharter />);
		const summary = screen.getByRole("button", { name: /点击展开折叠面板/ });
		expect(summary.getAttribute("aria-expanded")).toBe("false");
		fireEvent.click(summary);
		expect(summary.getAttribute("aria-expanded")).toBe("true");
	});

	it("骨架屏交接后展示真实内容", async () => {
		render(<MotionCharter />);
		expect(screen.queryByText("真实内容已就位")).toBeNull();
		await waitFor(
			() => {
				expect(screen.getByText("真实内容已就位")).toBeTruthy();
			},
			{ timeout: 3000 },
		);
	});
});
