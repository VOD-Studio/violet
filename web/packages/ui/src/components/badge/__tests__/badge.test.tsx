import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { Badge } from "../badge";

describe("Badge", () => {
	it("状态文字是可读内容，保留原生 span 属性与 ref", () => {
		const ref = createRef<HTMLSpanElement>();
		render(
			<Badge ref={ref} id="status" data-testid="badge">
				已发布
			</Badge>,
		);
		const badge = screen.getByTestId("badge");
		expect(badge.tagName).toBe("SPAN");
		expect(badge.id).toBe("status");
		expect(badge.textContent).toBe("已发布");
		expect(ref.current).toBe(badge);
	});

	it.each([
		"neutral",
		"ok",
		"accent",
		"warning",
		"off",
		"danger",
	] as const)("%s 状态带一个对读屏隐藏的圆点，文字不被污染", (tone) => {
		const { container } = render(<Badge tone={tone}>状态文字</Badge>);
		const hidden = container.querySelectorAll('[aria-hidden="true"]');
		expect(hidden).toHaveLength(1);
		expect(hidden[0]?.textContent).toBe("");
		expect(container.textContent).toBe("状态文字");
	});

	it("提供 icon 时图标取代圆点，同样对读屏隐藏", () => {
		const { container } = render(
			<Badge tone="accent" icon={<svg data-testid="clock" />}>
				定时 11.02 09:30
			</Badge>,
		);
		const hidden = container.querySelectorAll('[aria-hidden="true"]');
		expect(hidden).toHaveLength(1);
		expect(hidden[0]?.contains(screen.getByTestId("clock"))).toBe(true);
		expect(container.textContent).toBe("定时 11.02 09:30");
	});

	it("可作为按钮或链接的内容，不抢走宿主的名称", () => {
		render(
			<a href="/posts/1">
				文章 <Badge tone="ok">已发布</Badge>
			</a>,
		);
		expect(screen.getByRole("link", { name: "文章 已发布" })).toBeTruthy();
	});
});
