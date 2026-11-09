import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Alert } from "../alert";

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

describe("Alert", () => {
	it("信息、成功与警告用 status，危险用 alert 立即朗读", () => {
		const { rerender } = render(<Alert title="草稿已自动保存" />);
		expect(screen.getByRole("status").textContent).toContain("草稿已自动保存");
		rerender(<Alert tone="danger" title="同步失败" />);
		expect(screen.getByRole("alert").textContent).toContain("同步失败");
	});

	it("图标是装饰，语气由文字表达", () => {
		const { container } = render(
			<Alert tone="warning" title="封面尺寸偏小" description="建议宽度不小于 1600px" />,
		);
		const icon = container.querySelector(".v-alert__icon");
		expect(icon?.getAttribute("aria-hidden")).toBe("true");
		expect(container.textContent).toContain("封面尺寸偏小");
	});

	it("动作渲染为链接或按钮，关闭钮只在可关闭时出现", () => {
		const onAction = vi.fn();
		const onDismiss = vi.fn();
		render(
			<Alert
				tone="success"
				title="发布成功"
				action={{ label: "查看", href: "/posts/1" }}
				onDismiss={onDismiss}
			/>,
		);
		const link = screen.getByRole("link", { name: "查看" });
		expect(link.getAttribute("href")).toBe("/posts/1");
		expect(screen.getByRole("button", { name: "关闭" })).toBeTruthy();

		cleanup();
		render(<Alert title="提示" action={{ label: "重试", onClick: onAction }} dismissible />);
		fireEvent.click(screen.getByRole("button", { name: "重试" }));
		expect(onAction).toHaveBeenCalledTimes(1);
		expect(screen.getByRole("button", { name: "关闭" })).toBeTruthy();
	});

	it("关闭先淡出再收起，最后通知宿主", () => {
		vi.useFakeTimers();
		const onDismiss = vi.fn();
		render(
			<>
				<Alert title="可关闭" onDismiss={onDismiss} />
				<button type="button">下一个</button>
			</>,
		);
		fireEvent.click(screen.getByRole("button", { name: "关闭" }));
		expect(document.querySelector(".v-alert")?.getAttribute("data-state")).toBe("closing");
		act(() => {
			vi.advanceTimersByTime(340);
		});
		expect(onDismiss).toHaveBeenCalledTimes(1);
		expect(document.querySelector(".v-alert")).toBeNull();
	});

	it("紧凑形态只留图标与一句话，不渲染标题与关闭", () => {
		const { container } = render(
			<Alert
				compact
				tone="warning"
				title="改了站点地址后，旧地址会跳转 30 天。"
				onDismiss={() => undefined}
			/>,
		);
		expect(container.querySelector(".v-alert")?.hasAttribute("data-compact")).toBe(true);
		expect(screen.getByRole("status").textContent).toBe("改了站点地址后，旧地址会跳转 30 天。");
		expect(screen.queryByRole("button", { name: "关闭" })).toBeNull();
	});
});
