import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageShell } from "../PageShell";

/**
 * PageShell 内边距回归测试。
 *
 * 回归背景:内边距职责从 admin 布局 <main> 移入 PageShell 后,
 * 无标题区页面(description/action/sticky 均空)走 early return 裸 div,
 * 丢失内边距导致内容紧贴边缘(概览页)。
 */
describe("PageShell 内边距", () => {
	it("无标题区(early return)也保留页面内边距,内容不贴边", () => {
		const { container } = render(
			<PageShell title="概览">
				<p>内容</p>
			</PageShell>,
		);
		// 滚动容器无水平 padding(滚动条贴边),padding 下沉到内层 wrapper
		const wrapper = container.firstElementChild?.firstElementChild;
		expect(wrapper?.className).toContain("px-4");
	});

	it("有标题区(正常路径)内容区带内边距", () => {
		const { container } = render(
			<PageShell title="文章管理" description="管理博客文章">
				<p>内容</p>
			</PageShell>,
		);
		// .isolate 是滚动容器(无水平 padding),其内层 wrapper 带 padding
		const content = container.querySelector(".isolate > div");
		expect(content?.className).toContain("px-4");
	});
});
