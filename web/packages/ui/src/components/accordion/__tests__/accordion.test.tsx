import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Accordion, AccordionItem } from "../accordion";

afterEach(cleanup);

const trigger = (name: string) => screen.getByRole("button", { name: new RegExp(name) });
const expanded = (name: string) => trigger(name).getAttribute("aria-expanded") === "true";
const panelOf = (name: string) => {
	const id = trigger(name).getAttribute("aria-controls") ?? "";
	return document.getElementById(id) as HTMLElement;
};

function Faq(props: Parameters<typeof Accordion>[0]) {
	return (
		<Accordion {...props}>
			<AccordionItem value="review" title="评论需要审核吗？">
				<p>首次评论需要审核。</p>
			</AccordionItem>
			<AccordionItem value="repost" title="可以转载这里的文章吗？">
				<p>署名并附原文链接即可。</p>
			</AccordionItem>
			<AccordionItem value="links" title="怎么交换友链？">
				<p>在友链页底部提交申请。</p>
			</AccordionItem>
		</Accordion>
	);
}

describe("Accordion 结构与读屏", () => {
	it("标题是 h3 里的 button，aria-expanded 与 aria-controls 指向 role=region 的内容", () => {
		render(<Faq />);
		const heading = screen.getAllByRole("heading", { level: 3 })[0] as HTMLElement;
		const button = within(heading).getByRole("button", { name: "评论需要审核吗？" });
		expect(button.getAttribute("aria-expanded")).toBe("false");

		const panel = panelOf("评论需要审核吗");
		expect(panel.getAttribute("role")).toBe("region");
		expect(panel.getAttribute("aria-labelledby")).toBe(button.id);
		expect(screen.getAllByRole("heading")).toHaveLength(3);
	});

	it("headingLevel 改变标题级别", () => {
		render(<Faq headingLevel={4} />);
		expect(screen.getAllByRole("heading", { level: 4 })).toHaveLength(3);
		expect(screen.queryAllByRole("heading", { level: 3 })).toHaveLength(0);
	});

	it("收起的内容仍在文档里，用 inert 移出 Tab 顺序；展开后去掉 inert", () => {
		render(<Faq />);
		const panel = panelOf("评论需要审核吗");
		expect(panel.textContent).toContain("首次评论需要审核。");
		expect(panel.hasAttribute("inert")).toBe(true);
		expect(panel.hasAttribute("aria-hidden")).toBe(false);

		fireEvent.click(trigger("评论需要审核吗"));
		expect(panel.hasAttribute("inert")).toBe(false);

		fireEvent.click(trigger("评论需要审核吗"));
		expect(panel.hasAttribute("inert")).toBe(true);
	});

	it("服务端渲染的 aria-controls 与 aria-labelledby 能互相对上", () => {
		const html = renderToString(<Faq />);
		const doc = new DOMParser().parseFromString(html, "text/html");
		const button = doc.querySelector("button") as HTMLElement;
		const panel = doc.getElementById(button.getAttribute("aria-controls") ?? "");
		expect(panel?.getAttribute("aria-labelledby")).toBe(button.id);
	});

	it("原生属性、类名与 ref 落在根与各项的 DOM 上", () => {
		const ref = { current: null as HTMLDivElement | null };
		render(
			<Accordion ref={ref} className="faq" data-testid="root">
				<AccordionItem value="a" title="甲" className="first" data-testid="item">
					内容
				</AccordionItem>
			</Accordion>,
		);
		expect(ref.current).toBe(screen.getByTestId("root"));
		expect(screen.getByTestId("root").classList.contains("faq")).toBe(true);
		expect(screen.getByTestId("item").classList.contains("first")).toBe(true);
	});
});

describe("Accordion 多项展开（multiple）", () => {
	it("默认全部收起，点标题展开，再点收起", () => {
		render(<Faq />);
		expect(expanded("评论需要审核吗")).toBe(false);
		fireEvent.click(trigger("评论需要审核吗"));
		expect(expanded("评论需要审核吗")).toBe(true);
		fireEvent.click(trigger("评论需要审核吗"));
		expect(expanded("评论需要审核吗")).toBe(false);
	});

	it("可以同时展开多项", () => {
		render(<Faq />);
		fireEvent.click(trigger("评论需要审核吗"));
		fireEvent.click(trigger("怎么交换友链"));
		expect(expanded("评论需要审核吗")).toBe(true);
		expect(expanded("怎么交换友链")).toBe(true);
		expect(expanded("可以转载")).toBe(false);
	});

	it("defaultValue 决定初始展开项", () => {
		render(<Faq defaultValue={["repost", "links"]} />);
		expect(expanded("评论需要审核吗")).toBe(false);
		expect(expanded("可以转载")).toBe(true);
		expect(expanded("怎么交换友链")).toBe(true);
	});

	it("受控：点击只回调新值，展开状态跟随 value", () => {
		const onValueChange = vi.fn();
		const { rerender } = render(<Faq value={["links"]} onValueChange={onValueChange} />);
		fireEvent.click(trigger("评论需要审核吗"));
		expect(onValueChange).toHaveBeenCalledExactlyOnceWith(["links", "review"]);
		expect(expanded("评论需要审核吗")).toBe(false);

		rerender(<Faq value={["links", "review"]} onValueChange={onValueChange} />);
		expect(expanded("评论需要审核吗")).toBe(true);

		fireEvent.click(trigger("怎么交换友链"));
		expect(onValueChange).toHaveBeenLastCalledWith(["review"]);
	});
});

describe("Accordion 一次一项（single）", () => {
	function Settings(props: { onValueChange?: (value: string) => void; defaultValue?: string }) {
		return (
			<Accordion type="single" {...props}>
				<AccordionItem value="publish" title="发布设置" summary="立即发布 · 允许评论">
					发布方式
				</AccordionItem>
				<AccordionItem value="seo" title="搜索与分享" summary="已填写摘要">
					摘要
				</AccordionItem>
				<AccordionItem value="repost" title="转载信息">
					转载地址
				</AccordionItem>
			</Accordion>
		);
	}

	it("打开一项会收起其他项，再点已打开的一项可以收起", () => {
		const onValueChange = vi.fn();
		render(<Settings onValueChange={onValueChange} />);
		fireEvent.click(trigger("发布设置"));
		fireEvent.click(trigger("搜索与分享"));
		expect(expanded("发布设置")).toBe(false);
		expect(expanded("搜索与分享")).toBe(true);
		expect(onValueChange.mock.calls).toEqual([["publish"], ["seo"]]);

		fireEvent.click(trigger("搜索与分享"));
		expect(expanded("搜索与分享")).toBe(false);
		expect(onValueChange).toHaveBeenLastCalledWith("");
	});

	it("收起时标题里带摘要，展开后摘要隐藏", () => {
		render(<Settings defaultValue="seo" />);
		expect(trigger("发布设置").textContent).toContain("立即发布 · 允许评论");
		expect(trigger("搜索与分享").textContent).not.toContain("已填写摘要");

		fireEvent.click(trigger("发布设置"));
		expect(trigger("发布设置").textContent).not.toContain("立即发布 · 允许评论");
		expect(trigger("搜索与分享").textContent).toContain("已填写摘要");
	});

	it("受控：空串表示全部收起", () => {
		function Controlled() {
			const [value, setValue] = useState("publish");
			return (
				<Accordion type="single" value={value} onValueChange={setValue}>
					<AccordionItem value="publish" title="发布设置">
						内容
					</AccordionItem>
				</Accordion>
			);
		}
		render(<Controlled />);
		expect(expanded("发布设置")).toBe(true);
		fireEvent.click(trigger("发布设置"));
		expect(expanded("发布设置")).toBe(false);
	});
});

describe("Accordion 禁用项", () => {
	it("禁用的项不能展开，其余项不受影响", () => {
		const onValueChange = vi.fn();
		render(
			<Accordion onValueChange={onValueChange}>
				<AccordionItem value="a" title="甲" disabled>
					甲内容
				</AccordionItem>
				<AccordionItem value="b" title="乙">
					乙内容
				</AccordionItem>
			</Accordion>,
		);
		const disabled = trigger("甲") as HTMLButtonElement;
		expect(disabled.disabled).toBe(true);
		fireEvent.click(disabled);
		expect(expanded("甲")).toBe(false);
		expect(onValueChange).not.toHaveBeenCalled();

		fireEvent.click(trigger("乙"));
		expect(expanded("乙")).toBe(true);
	});
});
