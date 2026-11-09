import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Empty } from "../empty";

afterEach(cleanup);

describe("Empty", () => {
	it("标题、说明与出口按顺序呈现，整个空状态是 status", () => {
		render(
			<Empty
				title="还没有想法"
				description="写下第一条后会出现在这里。"
				action={<button type="button">记一条</button>}
			/>,
		);
		const status = screen.getByRole("status");
		expect(status.textContent).toContain("还没有想法");
		expect(status.textContent).toContain("写下第一条后会出现在这里。");
		expect(screen.getByRole("button", { name: "记一条" })).toBeTruthy();
	});

	it("插画只是装饰，对读屏隐藏", () => {
		const { container } = render(
			<Empty title="暂无内容" illustration={<svg data-testid="art" />} />,
		);
		const illustration = container.querySelector(".v-empty__illustration");
		expect(illustration?.getAttribute("aria-hidden")).toBe("true");
		expect(illustration?.contains(screen.getByTestId("art"))).toBe(true);
	});

	it("筛选无结果不放插画，直接写筛选条件", () => {
		const { container } = render(
			<Empty
				variant="plain"
				title="没有符合条件的文章"
				description="标签「Rust」· 系列「Yggdrasil」"
				illustration={<svg />}
				action={<button type="button">清除筛选</button>}
			/>,
		);
		expect(container.querySelector(".v-empty__illustration")).toBeNull();
		expect(screen.getByText("标签「Rust」· 系列「Yggdrasil」")).toBeTruthy();
	});

	it("面板紧凑形态只留图标与一句话", () => {
		const { container } = render(
			<Empty
				variant="compact"
				title="没有新消息"
				action={<button type="button">发消息</button>}
			/>,
		);
		const status = screen.getByRole("status");
		expect(container.querySelector(".v-empty__icon")?.getAttribute("aria-hidden")).toBe("true");
		expect(status.textContent).toBe("没有新消息");
		expect(screen.queryByRole("button", { name: "发消息" })).toBeNull();
	});
});
