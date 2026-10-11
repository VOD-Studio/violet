import type { SharedTweet } from "@features/chat/model/types";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

interface MockLinkProps {
	children: ReactNode;
	onClick?: (e: React.MouseEvent) => void;
	to?: string;
	params?: { username?: string };
}

const navigateMock = vi.fn();
vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => navigateMock,
	Link: ({ children, onClick, to, params }: MockLinkProps) => (
		<a href={to?.replace("$username", params?.username ?? "")} onClick={onClick}>
			{children}
		</a>
	),
}));

import { TweetShareCard } from "../TweetShareCard";

function makeSharedTweet(overrides: Partial<SharedTweet> = {}): SharedTweet {
	return {
		id: "tweet-1",
		author: { id: "u-author", username: "author", display_name: "Author", avatar_url: "" },
		content: "快来看这条推文",
		images: [],
		created_at: "2026-01-01T00:00:00Z",
		is_deleted: false,
		...overrides,
	};
}

describe("TweetShareCard — 分享的推文存在", () => {
	afterEach(() => {
		cleanup();
		navigateMock.mockClear();
	});

	it("渲染作者用户名与正文", () => {
		render(<TweetShareCard tweet={makeSharedTweet()} />);
		expect(screen.getByText("author")).toBeTruthy();
		expect(screen.getByText("快来看这条推文")).toBeTruthy();
	});

	it("点击卡片跳转推文详情页", () => {
		render(<TweetShareCard tweet={makeSharedTweet()} />);
		fireEvent.click(screen.getByRole("button", { name: /查看推文/ }));
		expect(navigateMock).toHaveBeenCalledWith({ to: "/tweets/$id", params: { id: "tweet-1" } });
	});

	it("图片是固定大小的小拼图，最多 4 格并以 +N 提示其余，不展开大图", () => {
		const urls = ["a", "b", "c", "d", "e", "f"].map((n) => `/uploads/${n}.png`);
		const { container } = render(<TweetShareCard tweet={makeSharedTweet({ images: urls })} />);
		const thumbs = container.querySelector("[data-count]");
		expect(thumbs?.getAttribute("data-count")).toBe("4");
		expect(thumbs?.querySelectorAll("img")).toHaveLength(4);
		expect(screen.getByText("+2")).toBeTruthy();
	});

	it("点击缩略图区域同样进入详情页", () => {
		const { container } = render(
			<TweetShareCard tweet={makeSharedTweet({ images: ["/uploads/a.png"] })} />,
		);
		fireEvent.click(container.querySelector("[data-count]") as HTMLElement);
		expect(navigateMock).toHaveBeenCalledWith({ to: "/tweets/$id", params: { id: "tweet-1" } });
	});
});

describe("TweetShareCard — 分享的推文已删除", () => {
	afterEach(() => {
		cleanup();
		navigateMock.mockClear();
	});

	it("渲染占位文案，不泄露任何原内容字段", () => {
		render(
			<TweetShareCard
				tweet={makeSharedTweet({
					is_deleted: true,
					author: undefined,
					content: undefined,
					images: undefined,
					created_at: undefined,
				})}
			/>,
		);
		expect(screen.getByText("该推文已被删除")).toBeTruthy();
		expect(screen.queryByText("author")).toBeNull();
		expect(screen.queryByText("快来看这条推文")).toBeNull();
	});

	it("已删除占位不可点击跳转", () => {
		render(<TweetShareCard tweet={makeSharedTweet({ is_deleted: true, author: undefined })} />);
		expect(screen.queryByRole("button")).toBeNull();
		expect(navigateMock).not.toHaveBeenCalled();
	});
});
