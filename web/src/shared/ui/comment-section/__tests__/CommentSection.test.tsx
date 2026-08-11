/**
 * shared comment-section 展示层测试
 *
 * 覆盖：
 * - CommentItem：头像兜底 / 作者徽章 / 审批中徽章 / 回复按钮登录门控 / 内联回复表单
 * - CommentRepliesBlock：toggle 模式（查看回复 → 懒加载展开）与 preview 模式（查看全部 N）
 *   + pending 去重（refetch 后预览已含新回复时不重复渲染）
 *
 * 组件纯展示（数据经 config 注入），无需 QueryClient / Router。
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommentItem } from "../CommentItem";
import { CommentRepliesBlock } from "../CommentRepliesBlock";
import type { CommentDisplayItem, CommentSectionConfig } from "../types";

/** 测试用原始评论（仅需 id 的最小约束） */
interface TRaw {
	id: string;
}

const mk = (
	id: string,
	over: Partial<CommentDisplayItem<TRaw>> = {},
): CommentDisplayItem<TRaw> => ({
	id,
	depth: 0,
	authorName: `user-${id}`,
	body: `body-${id}`,
	createdAt: "2026-01-01T00:00:00Z",
	raw: { id },
	...over,
});

function stubConfig(over: Partial<CommentSectionConfig<TRaw>> = {}): CommentSectionConfig<TRaw> {
	return {
		map: (raw) => mk(raw.id),
		repliesMode: "toggle",
		renderExpandedReplies: () => null,
		renderReplyForm: () => null,
		...over,
	};
}

describe("CommentItem", () => {
	afterEach(() => cleanup());

	it("无头像时渲染首字母兜底", () => {
		render(
			<CommentItem
				item={mk("c1", { authorAvatarUrl: undefined })}
				level={0}
				isLoggedIn={false}
				config={stubConfig()}
			/>,
		);
		expect(screen.getByText("U")).toBeTruthy();
	});

	it("作者本人渲染「作者」徽章", () => {
		render(
			<CommentItem
				item={mk("c1", { isAuthor: true })}
				level={0}
				isLoggedIn={false}
				config={stubConfig()}
			/>,
		);
		expect(screen.getAllByText("作者").length).toBe(1);
	});

	it("pending 渲染「审批中」徽章", () => {
		render(
			<CommentItem
				item={mk("c1", { isPending: true })}
				level={0}
				isLoggedIn={false}
				config={stubConfig()}
			/>,
		);
		expect(screen.getAllByText("审批中").length).toBe(1);
	});

	it("未登录不显示回复按钮", () => {
		render(<CommentItem item={mk("c1")} level={0} isLoggedIn={false} config={stubConfig()} />);
		expect(screen.queryByText("回复")).toBeNull();
	});

	it("toggle 模式：顶层评论 repliesTotal 为 0 且无 pending 时整块回复区不渲染", () => {
		render(
			<CommentItem
				item={mk("c1", { depth: 0, repliesTotal: 0 })}
				level={0}
				isLoggedIn={true}
				config={stubConfig()}
			/>,
		);
		expect(screen.queryByText("查看回复")).toBeNull();
	});

	it("登录后点「回复」展开内联回复表单", () => {
		const renderReplyForm = vi.fn(() => <form>reply-form</form>);
		const config = stubConfig({ renderReplyForm });
		render(<CommentItem item={mk("c1")} level={0} isLoggedIn={true} config={config} />);
		fireEvent.click(screen.getByText("回复"));
		expect(renderReplyForm).toHaveBeenCalledTimes(1);
		expect(screen.getByText("reply-form")).toBeTruthy();
	});
});

describe("CommentRepliesBlock", () => {
	afterEach(() => cleanup());

	it("toggle 模式：默认显示「查看回复」，点击后挂载懒加载区并显示「收起回复」", () => {
		const renderExpanded = vi.fn(() => <div>expanded-content</div>);
		const config = stubConfig({ repliesMode: "toggle", renderExpandedReplies: renderExpanded });
		render(
			<CommentRepliesBlock
				comment={mk("top", { depth: 0 })}
				isLoggedIn={true}
				config={config}
				pendingReplies={[]}
				onReplyAdded={() => {}}
			/>,
		);
		// 未展开：不触发懒加载
		expect(renderExpanded).not.toHaveBeenCalled();
		expect(screen.getAllByText("查看回复").length).toBe(1);

		fireEvent.click(screen.getByText("查看回复"));
		expect(renderExpanded).toHaveBeenCalledTimes(1);
		expect(screen.getByText("expanded-content")).toBeTruthy();
		expect(screen.getAllByText("收起回复").length).toBe(1);
	});

	it("toggle 模式：repliesTotal 为 0 时不显示「查看回复」按钮", () => {
		const config = stubConfig({ repliesMode: "toggle" });
		render(
			<CommentRepliesBlock
				comment={mk("top", { depth: 0, repliesTotal: 0 })}
				isLoggedIn={true}
				config={config}
				pendingReplies={[]}
				onReplyAdded={() => {}}
			/>,
		);
		expect(screen.queryByText("查看回复")).toBeNull();
	});

	it("toggle 模式：repliesTotal 为 0 但有 pending 回复时只显示 pending，不显示按钮", () => {
		const config = stubConfig({ repliesMode: "toggle" });
		render(
			<CommentRepliesBlock
				comment={mk("top", { depth: 0, repliesTotal: 0 })}
				isLoggedIn={true}
				config={config}
				pendingReplies={[mk("r1")]}
				onReplyAdded={() => {}}
			/>,
		);
		expect(screen.getAllByText("body-r1").length).toBe(1);
		expect(screen.queryByText("查看回复")).toBeNull();
	});

	it("preview 模式：回复总数超已显示时出现「查看全部 N 条回复」", () => {
		const config = stubConfig({ repliesMode: "preview" });
		const comment = mk("top", { depth: 0, repliesTotal: 5, repliesPreview: [mk("r1")] });
		render(
			<CommentRepliesBlock
				comment={comment}
				isLoggedIn={true}
				config={config}
				pendingReplies={[]}
				onReplyAdded={() => {}}
			/>,
		);
		expect(screen.getAllByText("查看全部 5 条回复").length).toBe(1);
	});

	it("preview 模式：总数等于已显示时无「查看全部」按钮", () => {
		const config = stubConfig({ repliesMode: "preview" });
		const comment = mk("top", { depth: 0, repliesTotal: 1, repliesPreview: [mk("r1")] });
		render(
			<CommentRepliesBlock
				comment={comment}
				isLoggedIn={true}
				config={config}
				pendingReplies={[]}
				onReplyAdded={() => {}}
			/>,
		);
		expect(screen.queryByText(/查看全部/)).toBeNull();
	});

	it("pending 与预览重复时不重复渲染（refetch 后预览已含新回复）", () => {
		const config = stubConfig({ repliesMode: "preview" });
		const comment = mk("top", { depth: 0, repliesTotal: 1, repliesPreview: [mk("r1")] });
		render(
			<CommentRepliesBlock
				comment={comment}
				isLoggedIn={true}
				config={config}
				pendingReplies={[mk("r1")]}
				onReplyAdded={() => {}}
			/>,
		);
		expect(screen.getAllByText("body-r1").length).toBe(1);
	});
});
