import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { type AvailableTweet, EmbeddedTweet } from "../unstyled.ts";

const tweet: AvailableTweet = {
	id: "31",
	url: "https://x.com/example/status/31",
	availability: "available",
	snapshot: {
		author: { name: "Author", handle: "example" },
		text: "第一段 😀\n第二段\n第三段\n第四段\n第五段\n最后一段与链接",
		segments: [
			{ kind: "text", text: "第一段 😀\n第二段\n第三段\n第四段\n第五段\n最后一段与" },
			{ kind: "link", text: "链接", url: "https://example.com/story" },
		],
	},
};
let fullHeight: number;
const observers = new Set<() => void>();

beforeEach(() => {
	fullHeight = 288;
	vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(() => fullHeight);
	const computedStyle = window.getComputedStyle.bind(window);
	vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
		const style = computedStyle(element);
		Object.defineProperty(style, "lineHeight", { value: "24px" });
		return style;
	});
	vi.stubGlobal(
		"ResizeObserver",
		class {
			constructor(private readonly callback: () => void) {}
			observe() {
				observers.add(this.callback);
			}
			disconnect() {
				observers.delete(this.callback);
			}
		},
	);
});

afterEach(() => {
	cleanup();
	observers.clear();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

it("展开与收起保留完整正文，裁切链接不进入 Tab 顺序，按钮不触发宿主导航", () => {
	const navigate = vi.fn();
	render(<EmbeddedTweet tweet={tweet} maxTextLines={4} locale="zh-CN" onClick={navigate} />);
	const button = screen.getByRole("button", { name: "展示更多" });
	const link = screen.getByRole("link", { name: "链接" });
	const body = document.getElementById(button.getAttribute("aria-controls") ?? "");
	expect(body?.textContent).toBe(tweet.snapshot.text);
	expect(button.getAttribute("aria-expanded")).toBe("false");
	expect(link.tabIndex).toBe(-1);
	fireEvent.click(button);
	expect(button.getAttribute("aria-expanded")).toBe("true");
	expect(body?.getAttribute("data-collapsed")).toBeNull();
	expect(link.tabIndex).toBe(0);
	fireEvent.click(screen.getByRole("button", { name: "收起" }));
	expect(button.getAttribute("aria-expanded")).toBe("false");
	expect(body?.textContent).toBe(tweet.snapshot.text);
	expect(navigate).not.toHaveBeenCalled();
});

it("换推文时恢复折叠，宽度改变后不再溢出的正文移除按钮", () => {
	const view = render(<EmbeddedTweet tweet={tweet} maxTextLines={4} />);
	fireEvent.click(screen.getByRole("button", { name: "Show more" }));
	view.rerender(
		<EmbeddedTweet
			tweet={{ ...tweet, id: "32", url: "https://x.com/example/status/32" }}
			maxTextLines={4}
		/>,
	);
	expect(screen.getByRole("button", { name: "Show more" }).getAttribute("aria-expanded")).toBe(
		"false",
	);
	act(() => {
		fullHeight = 72;
		for (const callback of observers) callback();
	});
	expect(screen.queryByRole("button")).toBeNull();
	expect(screen.getByRole("link", { name: "链接" }).tabIndex).toBe(0);
});

it("长引用与外层正文分别折叠，展开引用不展开外层或触发导航", () => {
	const navigate = vi.fn();
	const quoted = {
		...tweet,
		id: "32",
		url: "https://x.com/example/status/32",
		snapshot: { ...tweet.snapshot, text: "引用的完整正文", segments: undefined },
	};
	render(
		<EmbeddedTweet
			tweet={{ ...tweet, quotedTweet: quoted }}
			locale="zh-CN"
			onClick={navigate}
		/>,
	);
	const [outer, inner] = screen.getAllByRole("button", { name: "展示更多" });
	expect(outer.getAttribute("aria-expanded")).toBe("false");
	expect(inner.getAttribute("aria-expanded")).toBe("false");
	fireEvent.click(inner);
	expect(inner.getAttribute("aria-expanded")).toBe("true");
	expect(outer.getAttribute("aria-expanded")).toBe("false");
	expect(screen.getByRole("button", { name: "收起" })).toBe(inner);
	fireEvent.click(inner);
	expect(inner.getAttribute("aria-expanded")).toBe("false");
	expect(screen.getByText("引用的完整正文")).toBeTruthy();
	expect(navigate).not.toHaveBeenCalled();
});

it("显式关闭折叠时外层与引用均可直接访问全文链接", () => {
	render(
		<EmbeddedTweet
			tweet={{
				...tweet,
				quotedTweet: { ...tweet, id: "32", url: "https://x.com/example/status/32" },
			}}
			maxTextLines={0}
		/>,
	);
	expect(screen.queryByRole("button")).toBeNull();
	for (const link of screen.getAllByRole("link", { name: "链接" })) {
		expect(link.tabIndex).toBe(0);
	}
});
