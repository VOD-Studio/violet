import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { type AvailableTweet, EmbeddedTweet } from "../unstyled.js";

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

afterEach(cleanup);

it("完整显示多行正文与安全链接，正文冒泡而链接不触发宿主导航", () => {
	const navigate = vi.fn();
	const { container } = render(<EmbeddedTweet tweet={tweet} onClick={navigate} />);
	const body = container.querySelector(".v-tweet__text");
	const link = screen.getByRole("link", { name: "链接" });
	expect(body?.textContent).toBe(tweet.snapshot.text);
	expect(body?.getAttribute("dir")).toBe("auto");
	expect(body?.getAttribute("data-collapsed")).toBeNull();
	expect(body?.getAttribute("style")).toBeNull();
	expect(link.tabIndex).toBe(0);
	expect(link.getAttribute("href")).toBe("https://example.com/story");
	expect(screen.queryByRole("button")).toBeNull();
	fireEvent.click(body as HTMLElement);
	expect(navigate).toHaveBeenCalledTimes(1);
	fireEvent.click(link);
	expect(navigate).toHaveBeenCalledTimes(1);
});

it("没有分段时完整显示原文，不解释正文中的 HTML", () => {
	const text = `${tweet.snapshot.text}\n<script>alert(1)</script>`;
	const { container } = render(
		<EmbeddedTweet tweet={{ ...tweet, snapshot: { ...tweet.snapshot, text, segments: [] } }} />,
	);
	expect(container.querySelector(".v-tweet__text")?.textContent).toBe(text);
	expect(container.querySelector("script")).toBeNull();
});
