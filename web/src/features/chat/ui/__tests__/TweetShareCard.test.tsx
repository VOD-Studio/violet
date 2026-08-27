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

// ImageGrid 含 ImagePreview（重），mock 掉避免 Radix portal 干扰
vi.mock("@shared/ui/image-grid", () => ({
	ImageGrid: () => <div data-testid="image-grid" />,
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

	it("有图片时渲染 ImageGrid", () => {
		render(<TweetShareCard tweet={makeSharedTweet({ images: ["/uploads/a.png"] })} />);
		expect(screen.getByTestId("image-grid")).toBeTruthy();
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
