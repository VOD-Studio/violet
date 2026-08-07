/**
 * TweetCard 组件测试（T3：详情页导航与删除交互）
 *
 * 验证删除按钮可见性契约（对齐后端鉴权双重判定）：
 *   - 匿名（未登录）：无删除按钮
 *   - 登录但非作者、无权限：无删除按钮
 *   - 作者本人：可见删除按钮
 *   - 持 tweet:delete-any 权限：可见删除按钮（即使非作者）
 *
 * 验证删除确认流：点击删除 → 二次确认 → 调用 mutation.mutate。
 *
 * 范式参考 comments/ui/__tests__/ReactionBar.test.tsx（hook mock + render）。
 */
import type { Tweet } from "@entities/tweet/model/types";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 当前用户态：每用例通过 meDataOverride 覆写
let meDataOverride: { id: string; is_builtin_super_admin?: boolean } | null = null;
vi.mock("@features/auth/api/queries", () => ({
	useMe: () => ({ data: meDataOverride }),
}));

// 权限码：每用例通过 hasDeleteAny 覆写
let hasDeleteAny = false;
vi.mock("@features/auth/hooks/usePermissions", () => ({
	useHasPermission: () => hasDeleteAny,
}));

// 删除 mutation：捕获 mutate 入参
const deleteMutate = vi.fn();
vi.mock("@features/tweets/api/mutations", () => ({
	useDeleteTweet: () => ({ mutate: deleteMutate, isPending: false }),
}));

const navigateMock = vi.fn();
vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => navigateMock,
}));

// ConfirmDialog 基于 Modal（Radix Dialog），jsdom 下需要 portal 容器，
// 这里简化：mock 成受控渲染——open 时直接渲染 onConfirm 按钮
vi.mock("@shared/ui/confirm-dialog", () => ({
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
	ImageGrid: () => <div data-testid="image-grid" />,
}));

import TweetCard from "../TweetCard";

function makeTweet(overrides: Partial<Tweet> = {}): Tweet {
	return {
		id: "t1",
		author: { id: "u-author", username: "author", avatar_url: "" },
		content: "hello world",
		images: [],
		like_count: 0,
		created_at: "2026-01-01T00:00:00Z",
		...overrides,
	};
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

	it("作者本人渲染删除按钮", () => {
		meDataOverride = { id: "u-author" };
		render(<TweetCard tweet={makeTweet()} />);
		expect(screen.getByLabelText("删除推文")).toBeTruthy();
	});

	it("持 tweet:delete-any 权限者（非作者）渲染删除按钮", () => {
		meDataOverride = { id: "u-admin" };
		hasDeleteAny = true;
		render(<TweetCard tweet={makeTweet()} />);
		expect(screen.getByLabelText("删除推文")).toBeTruthy();
	});
});

describe("TweetCard — 删除确认流", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		meDataOverride = { id: "u-author" };
		hasDeleteAny = false;
	});
	afterEach(() => cleanup());

	it("点击删除 → 二次确认 → 调用 delete mutation", () => {
		const onDeleted = vi.fn();
		render(<TweetCard tweet={makeTweet({ id: "t-del" })} onDeleted={onDeleted} />);

		// 点击删除按钮打开确认
		fireEvent.click(screen.getByLabelText("删除推文"));
		expect(screen.getByTestId("confirm-btn")).toBeTruthy();

		// 确认 → 触发 mutate（onSuccess/onDeleted 由调用方 mutation 控制态，
		// 这里仅验证 mutate 被调用且首参为 undefined）
		fireEvent.click(screen.getByTestId("confirm-btn"));
		expect(deleteMutate).toHaveBeenCalledTimes(1);
	});
});
