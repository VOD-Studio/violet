import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEffect, useRef, useState } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BlockCommentTrigger } from "../BlockCommentTrigger";

const annotatedBlocks = new Set<HTMLElement>();

function Harness() {
	const contentRef = useRef<HTMLElement>(null);
	const layerRef = useRef<HTMLDivElement>(null);
	return (
		<>
			<article ref={contentRef} aria-label="文章正文">
				<p>可以反复悬停的段落。</p>
			</article>
			<div ref={layerRef}>
				<BlockCommentTrigger
					contentRef={contentRef}
					layerRef={layerRef}
					annotatedBlocks={annotatedBlocks}
					isLoggedIn
					postId="post-1"
				/>
			</div>
		</>
	);
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("连续离开正文与入口后重新悬停，旧隐藏任务不会关闭新入口", () => {
	render(<Harness />);
	const paragraph = screen.getByText("可以反复悬停的段落。");
	const article = screen.getByRole("article", { name: "文章正文" });
	fireEvent.mouseMove(paragraph);
	act(() => vi.advanceTimersToNextFrame());
	const trigger = screen.getByRole("button", { name: /^发表段评/ });
	fireEvent.mouseLeave(article);
	fireEvent.mouseLeave(trigger);
	fireEvent.mouseMove(paragraph);
	act(() => vi.advanceTimersToNextFrame());
	act(() => vi.advanceTimersByTime(300));
	expect(screen.getByRole("button", { name: /^发表段评/ })).toBe(trigger);
});

function hover(target: Element) {
	fireEvent.mouseMove(target);
	act(() => vi.advanceTimersToNextFrame());
}

it("从段落移向右侧入口途中经过正文留白，入口不消失", () => {
	render(<Harness />);
	const article = screen.getByRole("article", { name: "文章正文" });
	hover(screen.getByText("可以反复悬停的段落。"));
	const trigger = screen.getByRole("button", { name: /^发表段评/ });
	expect(trigger.dataset.show).toBe("true");

	hover(article);
	act(() => vi.advanceTimersByTime(100));
	expect(trigger.dataset.show).toBe("true");

	fireEvent.mouseLeave(article);
	fireEvent.mouseEnter(trigger);
	act(() => vi.advanceTimersByTime(2000));
	expect(trigger.dataset.show).toBe("true");
});

it("鼠标离开正文又没有进入入口，留出一段时间后才收起", () => {
	render(<Harness />);
	const article = screen.getByRole("article", { name: "文章正文" });
	hover(screen.getByText("可以反复悬停的段落。"));
	const trigger = screen.getByRole("button", { name: /^发表段评/ });

	fireEvent.mouseLeave(article);
	act(() => vi.advanceTimersByTime(150));
	expect(trigger.dataset.show).toBe("true");
	act(() => vi.advanceTimersByTime(500));
	expect(trigger.dataset.show).toBeUndefined();
});

/** 引用块里只有一个段落：两层都是可批注块，文字相同，批注挂在外层的引用块上。 */
function QuoteHarness({ quoteAnnotated }: { quoteAnnotated: boolean }) {
	const contentRef = useRef<HTMLElement>(null);
	const layerRef = useRef<HTMLDivElement>(null);
	const quoteRef = useRef<HTMLQuoteElement>(null);
	const [annotated, setAnnotated] = useState(new Set<HTMLElement>());
	useEffect(() => {
		if (quoteAnnotated && quoteRef.current) setAnnotated(new Set([quoteRef.current]));
	}, [quoteAnnotated]);
	return (
		<>
			<article ref={contentRef} aria-label="文章正文">
				<blockquote ref={quoteRef}>
					<p>引用块里唯一的段落。</p>
				</blockquote>
			</article>
			<div ref={layerRef}>
				<BlockCommentTrigger
					contentRef={contentRef}
					layerRef={layerRef}
					annotatedBlocks={annotated}
					isLoggedIn
					postId="post-1"
				/>
			</div>
		</>
	);
}

it("引用块已有批注时，悬停其中唯一的段落不再出现段评入口，页边留给头像组", () => {
	render(<QuoteHarness quoteAnnotated />);
	hover(screen.getByText("引用块里唯一的段落。"));
	expect(screen.getByTitle(/^发表段评/).dataset.show).toBeUndefined();
});

it("引用块没有批注时，悬停段落与悬停引用块外框都出现入口", () => {
	const { container } = render(<QuoteHarness quoteAnnotated={false} />);
	hover(screen.getByText("引用块里唯一的段落。"));
	const trigger = screen.getByRole("button", { name: /^发表段评/ });
	expect(trigger.dataset.show).toBe("true");
	hover(container.querySelector("blockquote") as Element);
	expect(trigger.dataset.show).toBe("true");
});

it("指针从段落右缘的任意高度移出，落进贴着段落的右侧热区，入口一直在", () => {
	const { container } = render(<Harness />);
	const article = screen.getByRole("article", { name: "文章正文" });
	hover(screen.getByText("可以反复悬停的段落。"));
	const trigger = screen.getByRole("button", { name: /^发表段评/ });
	const rail = container.querySelector("[data-trigger-rail]");
	if (!rail) throw new Error("悬停段落时应有右侧热区");

	fireEvent.mouseLeave(article);
	fireEvent.mouseEnter(rail);
	act(() => vi.advanceTimersByTime(3000));
	expect(trigger.dataset.show).toBe("true");

	fireEvent.mouseLeave(rail);
	act(() => vi.advanceTimersByTime(1000));
	expect(trigger.dataset.show).toBeUndefined();
});

it("指针刚从正文留白移上入口时，滞后的鼠标移动回调不会再安排收起", () => {
	render(<Harness />);
	const article = screen.getByRole("article", { name: "文章正文" });
	hover(screen.getByText("可以反复悬停的段落。"));
	const trigger = screen.getByRole("button", { name: /^发表段评/ });

	// 最后一次留白上的移动还排在下一帧，指针已经走到入口上
	fireEvent.mouseMove(article);
	fireEvent.mouseLeave(article);
	fireEvent.mouseEnter(trigger);
	act(() => vi.advanceTimersToNextFrame());
	act(() => vi.advanceTimersByTime(3000));
	expect(trigger.dataset.show).toBe("true");
});

it("服务端渲染不输出入口：样式随懒加载模块到位之前，它会露在正文左上角", () => {
	expect(renderToString(<Harness />)).not.toContain("发表段评");
});

it("浏览器里水合之后入口照常挂载", () => {
	render(<Harness />);
	expect(screen.getByTitle(/^发表段评/)).toBeTruthy();
});

/** 三段正文，第二段已有批注：键盘只在没有批注的段落之间移动。 */
function ParagraphsHarness() {
	const contentRef = useRef<HTMLElement>(null);
	const layerRef = useRef<HTMLDivElement>(null);
	const annotatedRef = useRef<HTMLParagraphElement>(null);
	const [annotated, setAnnotated] = useState(new Set<HTMLElement>());
	useEffect(() => {
		if (annotatedRef.current) setAnnotated(new Set([annotatedRef.current]));
	}, []);
	return (
		<>
			<article ref={contentRef} aria-label="文章正文">
				<p>第一段文字。</p>
				<p ref={annotatedRef}>已有批注的第二段。</p>
				<pre>代码块不能段评</pre>
				<p>第三段文字。</p>
			</article>
			<div ref={layerRef}>
				<BlockCommentTrigger
					contentRef={contentRef}
					layerRef={layerRef}
					annotatedBlocks={annotated}
					isLoggedIn
					postId="post-1"
				/>
			</div>
		</>
	);
}

it("不用悬停：Tab 聚焦入口即指向段落，上下方向键跳过已有批注的段落与代码块", () => {
	render(<ParagraphsHarness />);
	const trigger = screen.getByRole("button", { name: /^发表段评/ });
	act(() => trigger.focus());
	expect(trigger.dataset.show).toBe("true");
	expect(trigger.getAttribute("aria-label")).toBe("发表段评：第一段文字。");
	fireEvent.keyDown(trigger, { key: "ArrowDown" });
	expect(trigger.getAttribute("aria-label")).toBe("发表段评：第三段文字。");
	fireEvent.keyDown(trigger, { key: "ArrowDown" });
	expect(trigger.getAttribute("aria-label")).toBe("发表段评：第三段文字。");
	fireEvent.keyDown(trigger, { key: "ArrowUp" });
	expect(trigger.getAttribute("aria-label")).toBe("发表段评：第一段文字。");
	act(() => trigger.blur());
	expect(trigger.dataset.show).toBeUndefined();
});

it("触屏点按段落后入口出现在段落下方，点到代码块等不可段评处收起", () => {
	render(<ParagraphsHarness />);
	const trigger = screen.getByRole("button", { name: /^发表段评/ });
	fireEvent.pointerDown(screen.getByText("第一段文字。"), { pointerType: "touch" });
	expect(trigger.dataset.show).toBe("true");
	expect(trigger.dataset.placement).toBe("below");
	fireEvent.pointerDown(screen.getByText("代码块不能段评"), { pointerType: "touch" });
	expect(trigger.dataset.show).toBeUndefined();
});
