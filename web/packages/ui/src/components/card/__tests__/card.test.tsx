import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardFrame,
	CardFrameBody,
	CardFrameExcerpt,
	CardFrameImage,
	CardFrameMeta,
	CardFrameTitle,
	CardHeader,
	CardTitle,
} from "..";

describe("Card", () => {
	it("头部、正文、底部按组合顺序渲染，原生属性与 ref 透传", () => {
		const ref = createRef<HTMLDivElement>();
		render(
			<Card ref={ref} data-testid="card" className="caller">
				<CardHeader>
					<CardTitle>同步到 Mastodon</CardTitle>
					<CardDescription>新推文会同时发到你的账号</CardDescription>
				</CardHeader>
				<CardContent>已连接 @rua</CardContent>
				<CardFooter>
					<button type="button">稍后</button>
					<button type="button">断开</button>
				</CardFooter>
			</Card>,
		);
		const card = screen.getByTestId("card");
		expect(ref.current).toBe(card);
		expect(card.classList.contains("caller")).toBe(true);
		const text = card.textContent ?? "";
		expect(text.indexOf("同步到 Mastodon")).toBeLessThan(text.indexOf("已连接"));
		expect(text.indexOf("已连接")).toBeLessThan(text.indexOf("稍后"));
		expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["稍后", "断开"]);
	});

	it("CardAction 留在头部内并保持可操作", () => {
		const onClick = vi.fn();
		render(
			<CardHeader data-testid="header">
				<CardTitle>标题</CardTitle>
				<CardAction>
					<button type="button" onClick={onClick}>
						编辑
					</button>
				</CardAction>
			</CardHeader>,
		);
		const button = screen.getByRole("button", { name: "编辑" });
		expect(screen.getByTestId("header").contains(button)).toBe(true);
		fireEvent.click(button);
		expect(onClick).toHaveBeenCalledTimes(1);
	});
});

function PostCard({ onAction }: { onAction?: () => void }) {
	return (
		<CardFrame data-testid="frame">
			<CardFrameImage>
				<img alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" />
			</CardFrameImage>
			<CardFrameBody>
				<CardFrameTitle asChild>
					<a href="/blog/seasons">给博客加了季节</a>
				</CardFrameTitle>
				<CardFrameMeta>2026-11-02 · 技术</CardFrameMeta>
				<CardFrameExcerpt>背景跟着季节换。</CardFrameExcerpt>
				{onAction ? (
					<button type="button" onClick={onAction}>
						收藏
					</button>
				) : null}
			</CardFrameBody>
		</CardFrame>
	);
}

describe("CardFrame", () => {
	it("只有标题是链接，可访问名称为标题文本", () => {
		render(<PostCard />);
		const links = screen.getAllByRole("link");
		expect(links).toHaveLength(1);
		expect(links[0]).toBe(screen.getByRole("link", { name: "给博客加了季节" }));
		expect(links[0].getAttribute("href")).toBe("/blog/seasons");
	});

	it("元信息在 DOM 中位于标题之后", () => {
		render(<PostCard />);
		const title = screen.getByRole("link", { name: "给博客加了季节" });
		const meta = screen.getByText("2026-11-02 · 技术");
		expect(title.compareDocumentPosition(meta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});

	it("内嵌按钮可独立聚焦，点击不触发链接", () => {
		const onAction = vi.fn();
		const onLink = vi.fn((event: Event) => event.preventDefault());
		render(<PostCard onAction={onAction} />);
		const link = screen.getByRole("link");
		link.addEventListener("click", onLink);
		const button = screen.getByRole("button", { name: "收藏" });
		button.focus();
		expect(document.activeElement).toBe(button);
		fireEvent.click(button);
		expect(onAction).toHaveBeenCalledTimes(1);
		expect(onLink).not.toHaveBeenCalled();
	});

	it("标题不用 asChild 时渲染为普通文本而非链接", () => {
		render(
			<CardFrame>
				<CardFrameBody>
					<CardFrameTitle>未发布的文章</CardFrameTitle>
				</CardFrameBody>
			</CardFrame>,
		);
		expect(screen.queryByRole("link")).toBeNull();
		expect(screen.getByText("未发布的文章")).toBeTruthy();
	});

	it("标题 ref 与 className 透传到链接", () => {
		const ref = createRef<HTMLAnchorElement>();
		render(
			<CardFrameTitle asChild ref={ref} className="caller">
				<a href="/x">文章</a>
			</CardFrameTitle>,
		);
		const link = screen.getByRole("link", { name: "文章" });
		expect(ref.current).toBe(link);
		expect(link.classList.contains("caller")).toBe(true);
	});
});
