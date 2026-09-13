/**
 * Disclosure 组件测试
 *
 * 覆盖折叠行为：默认收起、defaultOpen 展开、hint 渲染、
 * 点击摘要行切换开合（aria-expanded 与 data-state 同步）。
 * 断言风格跟随项目惯例（.toBeTruthy，无 jest-dom）。
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Disclosure } from "../disclosure";

afterEach(() => {
	cleanup();
});

describe("Disclosure", () => {
	it("默认收起，标题与 hint 渲染", () => {
		render(
			<Disclosure label="查看字段来源" hint="数据库覆盖">
				<p>内容文本</p>
			</Disclosure>,
		);

		expect(screen.getByText("查看字段来源")).toBeTruthy();
		expect(screen.getByText("数据库覆盖")).toBeTruthy();
		expect(
			screen.getByRole("button", { name: /查看字段来源/ }).getAttribute("aria-expanded"),
		).toBe("false");
	});

	it("defaultOpen 初始展开", () => {
		render(
			<Disclosure label="详情" defaultOpen>
				<p>内容文本</p>
			</Disclosure>,
		);

		expect(screen.getByRole("button", { name: /详情/ }).getAttribute("aria-expanded")).toBe(
			"true",
		);
		expect(screen.getByText("内容文本")).toBeTruthy();
	});

	it("点击摘要行切换开合并同步 data-state", () => {
		render(
			<Disclosure label="采集已启用">
				<p>内容文本</p>
			</Disclosure>,
		);

		const trigger = screen.getByRole("button", { name: /采集已启用/ });
		fireEvent.click(trigger);
		expect(trigger.getAttribute("aria-expanded")).toBe("true");
		expect(trigger.closest("[data-state]")?.getAttribute("data-state")).toBe("open");
		fireEvent.click(trigger);
		expect(trigger.closest("[data-state]")?.getAttribute("data-state")).toBe("closed");
	});
});
