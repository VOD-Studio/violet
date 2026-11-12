import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuoteCard } from "../quote-card";

const base = {
	href: "/tweets/9f2c",
	label: "查看 xunrua 的这条推文",
	authorName: "xunrua",
	authorAvatar: "/uploads/avatar.webp",
	time: "2 小时前",
	timeTitle: "2026-11-10 09:12",
	content: "给博客加了季节。春天落桃花，秋天落桂花，冬天的雪会积在导航上。",
	imageSrc: "/uploads/season.webp",
};

describe("QuoteCard", () => {
	afterEach(() => cleanup());

	it("整卡是一处链接，链接名称由 label 提供", () => {
		const { container } = render(<QuoteCard {...base} />);
		const links = screen.getAllByRole("link");
		expect(links).toHaveLength(1);
		const link = links[0];
		expect(link.getAttribute("href")).toBe(base.href);
		expect(link.getAttribute("aria-label")).toBe(base.label);
		expect(links[0]?.textContent).toContain(base.content);
		// 根节点不是按钮也不是链接，点击区由正文链接的覆盖层扩展
		expect(container.firstElementChild?.getAttribute("role")).toBeNull();
		expect(link.contains(container.firstElementChild)).toBe(false);
	});

	it("作者、时间与单张缩略图渲染在卡内", () => {
		const { container } = render(<QuoteCard {...base} />);
		expect(screen.getByText(base.authorName)).toBeTruthy();
		expect(screen.getByText(base.time).getAttribute("title")).toBe(base.timeTitle);
		const images = container.querySelectorAll(".v-quote-card__image");
		expect(images).toHaveLength(1);
		expect(images[0]?.getAttribute("src")).toBe(base.imageSrc);
	});

	it("附加上操作的按钮不落在链接里，独立可点", () => {
		const onCancel = vi.fn();
		render(
			<QuoteCard
				{...base}
				action={
					<button type="button" aria-label="取消引用" onClick={onCancel}>
						取消
					</button>
				}
			/>,
		);
		const button = screen.getByRole("button", { name: "取消引用" });
		expect(screen.getByRole("link").contains(button)).toBe(false);
		fireEvent.click(button);
		expect(onCancel).toHaveBeenCalledOnce();
	});

	it("省略 href 时只展示内容，不生成链接", () => {
		const { container } = render(<QuoteCard {...base} href={undefined} />);
		expect(screen.queryByRole("link")).toBeNull();
		expect(container.querySelector(".v-quote-card__link")).toBeNull();
		expect(screen.getByText(base.content)).toBeTruthy();
	});

	it("嵌套引用只写一行提示，不再嵌第二张卡", () => {
		const { container } = render(<QuoteCard {...base} nested="引用了一条推文" />);
		expect(screen.getByText("引用了一条推文")).toBeTruthy();
		expect(container.querySelectorAll(".v-quote-card")).toHaveLength(1);
	});

	it("删除态不渲染作者、时间、缩略图与链接", () => {
		const { container } = render(<QuoteCard {...base} deleted />);
		expect(screen.getByText("原推文已删除")).toBeTruthy();
		expect(screen.queryByText(base.authorName)).toBeNull();
		expect(screen.queryByText(base.time)).toBeNull();
		expect(screen.queryByRole("link")).toBeNull();
		expect(container.querySelector("img")).toBeNull();
		expect(container.querySelector("[tabindex]")).toBeNull();
		expect(container.firstElementChild?.getAttribute("data-state")).toBe("deleted");
	});

	it("删除态文案可覆盖，内容字段一律不出现", () => {
		render(<QuoteCard deleted deletedLabel="该推文已被删除" {...base} />);
		expect(screen.getByText("该推文已被删除")).toBeTruthy();
		expect(screen.queryByText(base.content)).toBeNull();
		expect(screen.queryByText(base.authorName)).toBeNull();
	});

	it("ref 与 className 落在根元素", () => {
		const ref = createRef<HTMLDivElement>();
		const { container } = render(<QuoteCard {...base} ref={ref} className="w-80" />);
		expect(ref.current).toBe(container.firstElementChild);
		expect(ref.current?.classList.contains("v-quote-card")).toBe(true);
		expect(ref.current?.classList.contains("w-80")).toBe(true);
	});
});
