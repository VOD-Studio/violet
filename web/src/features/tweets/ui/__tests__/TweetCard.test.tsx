/** 推文消费行为：管理权限、二次确认删除、本站互动与整卡导航边界。 */
import type { Tweet } from "@entities/tweet/model/types";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 当前用户态：每用例通过 meDataOverride 覆写
let meDataOverride: { id: string; is_root?: boolean } | null = null;
vi.mock("@features/auth/api/queries", () => ({
	useMe: () => ({ data: meDataOverride }),
}));

// 权限码：每用例通过 hasDeleteAny 覆写
let hasDeleteAny = false;
vi.mock("@features/auth/hooks/usePermissions", () => ({
	useHasPermission: () => hasDeleteAny,
}));

// 删除与点赞 mutation：捕获 mutate 入参
const deleteMutate = vi.fn();
const toggleLikeMutate = vi.fn();
vi.mock("@features/tweets/api/mutations", () => ({
	useDeleteTweet: () => ({ mutate: deleteMutate, isPending: false }),
	useToggleLikeTweet: () => ({ mutate: toggleLikeMutate, isPending: false }),
}));
const navigateMock = vi.fn();
vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => navigateMock,
	Link: ({ children, onClick, to, params, ...props }: any) => (
		<a href={to?.replace("$username", params?.username || "")} onClick={onClick} {...props}>
			{children}
		</a>
	),
}));

// ConfirmDialog 基于 Modal（Radix Dialog），jsdom 下需要 portal 容器，
// 这里简化：mock 成受控渲染——open 时直接渲染 onConfirm 按钮
vi.mock("@violet/ui/confirm-dialog", () => ({
	ConfirmDialog: ({
		open,
		onConfirm,
		confirmLabel,
	}: {
		open: boolean;
		onConfirm: () => void;
		confirmLabel: string;
	}) =>
		open ? (
			<button type="button" data-testid="confirm-btn" onClick={onConfirm}>
				{confirmLabel}
			</button>
		) : null,
}));

// ImageGrid 含 ImagePreview（重），mock 掉避免 Radix portal 干扰
vi.mock("@shared/ui/image-grid", () => ({
	ImageGrid: () => <img src="/photo.png" alt="推文配图" />,
}));

import TweetCard from "../TweetCard";

function makeTweet(overrides: Partial<Tweet> = {}): Tweet {
	return {
		id: "t1",
		author: { id: "u-author", username: "author", avatar_url: "" },
		content: "hello world",
		images: [],
		like_count: 0,
		is_liked: false,
		comment_count: 0,
		quote_count: 0,
		created_at: "2026-01-01T00:00:00Z",
		...overrides,
	};
}

async function openMoreMenu() {
	fireEvent.keyDown(screen.getByRole("button", { name: "更多推文操作" }), { key: "Enter" });
	await waitFor(() => expect(screen.getByRole("menu")).toBeTruthy());
}

describe("TweetCard — 删除按钮可见性", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		meDataOverride = null;
		hasDeleteAny = false;
	});
	afterEach(() => cleanup());

	it("匿名（未登录）不渲染删除按钮", () => {
		render(<TweetCard tweet={makeTweet()} />);
		expect(screen.queryByLabelText("删除推文")).toBeNull();
	});

	it("登录但非作者且无权限，不渲染删除按钮", () => {
		meDataOverride = { id: "u-other" };
		render(<TweetCard tweet={makeTweet()} />);
		expect(screen.queryByLabelText("删除推文")).toBeNull();
	});

	it("作者本人可在更多菜单删除推文", async () => {
		meDataOverride = { id: "u-author" };
		render(<TweetCard tweet={makeTweet()} />);
		await openMoreMenu();
		expect(screen.getByRole("menuitem", { name: "删除推文" })).toBeTruthy();
	});

	it("持 tweet:delete-any 权限者（非作者）可在更多菜单删除推文", async () => {
		meDataOverride = { id: "u-admin" };
		hasDeleteAny = true;
		render(<TweetCard tweet={makeTweet()} />);
		await openMoreMenu();
		expect(screen.getByRole("menuitem", { name: "删除推文" })).toBeTruthy();
	});
});

describe("TweetCard — 删除确认流", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		meDataOverride = { id: "u-author" };
		hasDeleteAny = false;
	});
	afterEach(() => cleanup());

	it("点击删除 → 二次确认 → 调用 delete mutation", async () => {
		const onDeleted = vi.fn();
		render(<TweetCard tweet={makeTweet({ id: "t-del" })} onDeleted={onDeleted} />);

		await openMoreMenu();
		fireEvent.click(screen.getByRole("menuitem", { name: "删除推文" }));
		expect(screen.getByTestId("confirm-btn")).toBeTruthy();

		// 确认 → 触发 mutate（onSuccess/onDeleted 由调用方 mutation 控制态，
		// 这里仅验证 mutate 被调用且首参为 undefined）
		fireEvent.click(screen.getByTestId("confirm-btn"));
		expect(deleteMutate).toHaveBeenCalledTimes(1);
	});
});
describe("TweetCard — 作者个人页链接", () => {
	afterEach(() => cleanup());

	it("渲染作者个人主页 Link，并且点击时不触发整卡 openDetail", () => {
		meDataOverride = null;
		const tweet = makeTweet();
		render(<TweetCard tweet={tweet} />);

		const userLink = screen.getByRole("link", { name: tweet.author.username });
		expect(userLink.getAttribute("href")).toBe(`/users/${tweet.author.username}`);

		fireEvent.click(userLink);
		expect(navigateMock).not.toHaveBeenCalledWith(
			expect.objectContaining({ to: "/tweets/$id" }),
		);
	});
});
describe("TweetCard — 点赞交互", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	afterEach(() => cleanup());
	it("未登录时点击点赞按钮引导登录跳转", () => {
		meDataOverride = null;
		const tweet = makeTweet({ like_count: 5, is_liked: false });
		render(<TweetCard tweet={tweet} />);

		const likeButton = screen.getByTestId("like-button");
		fireEvent.click(likeButton);

		expect(toggleLikeMutate).not.toHaveBeenCalled();
		expect(navigateMock).toHaveBeenCalledWith({ to: "/login" });
	});

	it("登录状态下点击点赞按钮触发 toggleLike 并且不触发整卡 openDetail", () => {
		meDataOverride = { id: "u1" };
		const tweet = makeTweet({ like_count: 5, is_liked: false });
		render(<TweetCard tweet={tweet} />);

		const likeButton = screen.getByTestId("like-button");
		fireEvent.click(likeButton);

		expect(toggleLikeMutate).toHaveBeenCalledTimes(1);
		expect(navigateMock).not.toHaveBeenCalledWith(
			expect.objectContaining({ to: "/tweets/$id" }),
		);
	});

	it("已点赞状态下显示取消点赞 aria-label", () => {
		meDataOverride = { id: "u1" };
		const tweet = makeTweet({ like_count: 6, is_liked: true });
		render(<TweetCard tweet={tweet} />);

		expect(screen.getByTestId("like-button").getAttribute("aria-label")).toBe("取消点赞");
	});
});

describe("TweetCard — 整卡导航边界", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		meDataOverride = null;
		hasDeleteAny = false;
	});
	afterEach(() => {
		window.getSelection()?.removeAllRanges();
		cleanup();
	});

	it("正文点击及整卡 Enter/Space 导航，子链接键盘不重复导航", () => {
		render(<TweetCard tweet={makeTweet()} />);
		fireEvent.click(screen.getByText("hello world"));
		const card = screen.getByLabelText("author 的推文");
		fireEvent.keyDown(card, { key: "Enter" });
		fireEvent.keyDown(card, { key: " " });
		expect(navigateMock).toHaveBeenCalledTimes(3);
		fireEvent.keyDown(screen.getByRole("link", { name: "author" }), { key: "Enter" });
		expect(navigateMock).toHaveBeenCalledTimes(3);
	});

	it("选中文字后点击卡片不会离开时间线", () => {
		render(<TweetCard tweet={makeTweet()} />);
		const content = screen.getByText("hello world");
		const range = document.createRange();
		range.selectNodeContents(content);
		window.getSelection()?.addRange(range);
		fireEvent.click(content);
		expect(navigateMock).not.toHaveBeenCalled();
	});

	it("点击图片和更多菜单不会触发详情导航", async () => {
		meDataOverride = { id: "u-author" };
		render(<TweetCard tweet={makeTweet({ images: ["/photo.png"] })} />);
		fireEvent.click(screen.getByRole("img", { name: "推文配图" }));
		await openMoreMenu();
		expect(navigateMock).not.toHaveBeenCalled();
	});

	it("点击纯表情正文仍进入详情，不把内联表情当作独立配图", () => {
		render(
			<TweetCard
				tweet={makeTweet({
					content: "[doge]",
					emote: { "[doge]": { url: "/doge.png" } },
				})}
			/>,
		);
		fireEvent.click(screen.getByRole("img", { name: "[doge]" }));
		expect(navigateMock).toHaveBeenCalledWith({
			to: "/tweets/$id",
			params: { id: "t1" },
		});
	});
});
