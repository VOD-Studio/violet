import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { type AvailableTweet, EmbeddedTweet } from "../unstyled.js";

const tweet: AvailableTweet = {
	id: "20",
	url: "https://x.com/author/status/20",
	availability: "available",
	snapshot: {
		author: {
			name: "作者",
			handle: "author",
			verification: "individual",
			affiliation: {
				name: "关联组织",
				imageUrl: "/organization.png",
				url: "https://x.com/organization",
			},
		},
		text: "正文",
		metrics: { likes: 0, replies: 12, reposts: 3 },
	},
};

afterEach(cleanup);

it("姓名、账号与组织各有独立的导航目标，未知认证不渲染徽章", () => {
	const view = render(<EmbeddedTweet tweet={tweet} locale="zh-CN" />);
	const name = screen.getByText("作者");
	const handle = screen.getByRole("link", { name: "@author" });
	expect(name.closest("a")?.getAttribute("href")).toBe("https://x.com/author");
	expect(name.closest("a")?.contains(handle)).toBe(false);
	expect(screen.getByRole("link", { name: "关联组织" }).getAttribute("href")).toBe(
		"https://x.com/organization",
	);
	expect(screen.getByRole("img", { name: "已认证" })).toBeTruthy();
	view.rerender(
		<EmbeddedTweet
			tweet={{
				...tweet,
				snapshot: { ...tweet.snapshot, author: { name: "作者", handle: "author" } },
			}}
			locale="zh-CN"
		/>,
	);
	expect(screen.queryByRole("img", { name: "已认证" })).toBeNull();
	expect(screen.queryByRole("link", { name: "关联组织" })).toBeNull();
});

it("点赞和回复跳转到当前推文的真实操作入口，不冒泡至宿主", () => {
	const click = vi.fn();
	render(<EmbeddedTweet tweet={tweet} onClick={click} locale="zh-CN" />);
	const like = screen.getByRole("link", { name: "在 X 点赞. 0 赞" });
	const reply = screen.getByRole("link", { name: "在 X 回复. 12 回复" });
	expect(like.getAttribute("href")).toBe("https://twitter.com/intent/like?tweet_id=20");
	expect(reply.getAttribute("href")).toBe("https://twitter.com/intent/tweet?in_reply_to=20");
	fireEvent.click(like);
	fireEvent.click(reply);
	expect(click).not.toHaveBeenCalled();
	fireEvent.click(screen.getByText("正文"));
	expect(click).toHaveBeenCalledTimes(1);
});

it("保存快照可从 X 地址解析操作标识，但任意网站 URL 不生成 X 操作", () => {
	const view = render(
		<EmbeddedTweet
			tweet={{ ...tweet, id: undefined, url: "https://x.com/author/status/42" }}
			locale="zh-CN"
		/>,
	);
	expect(screen.getByRole("link", { name: "在 X 点赞. 0 赞" }).getAttribute("href")).toBe(
		"https://twitter.com/intent/like?tweet_id=42",
	);
	view.rerender(
		<EmbeddedTweet
			tweet={{ ...tweet, id: undefined, url: "https://example.com/status/42" }}
			locale="zh-CN"
		/>,
	);
	expect(screen.queryByRole("link", { name: /在 X 点赞/ })).toBeNull();
	expect(screen.queryByRole("link", { name: /在 X 回复/ })).toBeNull();
	expect(screen.getByText("0 赞")).toBeTruthy();
});
