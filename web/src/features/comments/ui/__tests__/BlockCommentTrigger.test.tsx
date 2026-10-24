import { act, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
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
	const trigger = screen.getByRole("button", { name: "发表段评" });
	fireEvent.mouseLeave(article);
	fireEvent.mouseLeave(trigger);
	fireEvent.mouseMove(paragraph);
	act(() => vi.advanceTimersToNextFrame());
	act(() => vi.advanceTimersByTime(300));
	expect(screen.getByRole("button", { name: "发表段评" })).toBe(trigger);
});
