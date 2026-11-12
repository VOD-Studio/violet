import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { CommentHeader, CommentItem, CommentList, CommentReplies } from "..";

const identity = {
	author: "林间",
	avatar: <img src="/avatar.png" alt="" />,
	dateTime: "2026-11-12T08:00:00Z",
	time: "2 小时前",
};

function ReplyExample() {
	const [open, setOpen] = useState(false);
	let replyForm = null;
	if (open) {
		replyForm = (
			<form>
				<input type="hidden" name="commentId" value="one" />
				<input type="checkbox" aria-label="订阅提醒" />
				<input type="submit" value="提交回复" />
				<input aria-label="不可用" disabled />
				<input aria-label="只读" readOnly />
				<textarea aria-label="回复正文" />
			</form>
		);
	}
	return (
		<CommentItem {...identity} onReply={() => setOpen(!open)} replyForm={replyForm}>
			原评论
		</CommentItem>
	);
}

describe("Comment 语义与状态", () => {
	it("宿主 li 保持顶层与回复 ol，评论使用 article、元信息 header 与机器可读 time", () => {
		render(
			<CommentList aria-label="评论列表">
				<li>
					<CommentItem
						{...identity}
						isAuthor
						badges={<span>贡献者</span>}
						replies={
							<CommentReplies aria-label="回复列表">
								<li>
									<CommentItem {...identity} reply replyTo="阿明">
										收到
									</CommentItem>
								</li>
							</CommentReplies>
						}
					>
						原评论
					</CommentItem>
				</li>
			</CommentList>,
		);
		const list = screen.getByRole("list", { name: "评论列表" });
		const replies = screen.getByRole("list", { name: "回复列表" });
		expect(list.tagName).toBe("OL");
		expect(replies.tagName).toBe("OL");
		expect(list.children[0]?.tagName).toBe("LI");
		expect(replies.children[0]?.tagName).toBe("LI");
		const articles = screen.getAllByRole("article");
		expect(articles).toHaveLength(2);
		const meta = articles[0].querySelector("header");
		expect(meta?.textContent).toContain("贡献者");
		expect(meta?.querySelector("time")?.getAttribute("datetime")).toBe(identity.dateTime);
		expect(within(articles[0]).getByText("作者")).toBeTruthy();
		expect(within(articles[1]).getByText("回复 @阿明")).toBeTruthy();
	});

	it("待审核可见性明确，删除后不挂载原文、操作和表单，但保留回复位置", () => {
		const onReply = vi.fn();
		const { rerender } = render(
			<CommentItem {...identity} status="pending" onReply={onReply}>
				未审核正文
			</CommentItem>,
		);
		expect(screen.getByText("待审核 · 仅自己可见")).toBeTruthy();
		expect(screen.getByText("未审核正文")).toBeTruthy();
		rerender(
			<CommentItem
				{...identity}
				status="deleted"
				onReply={onReply}
				actions={<button type="button">回应</button>}
				replyForm={<textarea aria-label="不能暴露的表单" />}
				replies={<CommentReplies aria-label="保留的回复" />}
			>
				不能暴露的原文
			</CommentItem>,
		);
		expect(screen.getByRole("article")).toBeTruthy();
		expect(screen.getByText("这条评论已删除")).toBeTruthy();
		expect(screen.queryByText("不能暴露的原文")).toBeNull();
		expect(screen.queryByRole("button")).toBeNull();
		expect(screen.queryByRole("textbox")).toBeNull();
		expect(screen.getByRole("list", { name: "保留的回复" })).toBeTruthy();
		expect(onReply).not.toHaveBeenCalled();
	});

	it("没有回复回调就没有回复操作，回应槽保持可交互", () => {
		const onReact = vi.fn();
		render(
			<CommentItem
				{...identity}
				actions={
					<button type="button" onClick={onReact}>
						微笑，2 人
					</button>
				}
			>
				正文
			</CommentItem>,
		);
		expect(screen.queryByRole("button", { name: "回复" })).toBeNull();
		expect(screen.queryByRole("button", { name: "取消" })).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "微笑，2 人" }));
		expect(onReact).toHaveBeenCalledTimes(1);
	});

	it("无排序回调不显示假控件，真实 Segmented 只报告受控排序意图", () => {
		const onSortChange = vi.fn();
		const { rerender } = render(<CommentHeader title={<h2>评论</h2>} count={0} />);
		expect(screen.getByRole("heading", { name: "评论" })).toBeTruthy();
		expect(screen.getByText("0")).toBeTruthy();
		expect(screen.queryByRole("radiogroup")).toBeNull();
		rerender(<CommentHeader title="评论" sort="latest" onSortChange={onSortChange} />);
		const group = screen.getByRole("radiogroup", { name: "评论排序" });
		const latest = within(group).getByRole("radio", { name: "最新" });
		const hot = within(group).getByRole("radio", { name: "最热" });
		fireEvent.click(hot);
		expect(onSortChange).toHaveBeenCalledTimes(1);
		expect(onSortChange).toHaveBeenLastCalledWith("hot");
		expect(latest.getAttribute("aria-checked")).toBe("true");
		expect(hot.getAttribute("aria-checked")).toBe("false");
		rerender(<CommentHeader title="评论" sort="hot" onSortChange={onSortChange} />);
		expect(hot.getAttribute("aria-checked")).toBe("true");
		act(() => hot.focus());
		fireEvent.keyDown(hot, { key: "ArrowLeft" });
		expect(document.activeElement).toBe(latest);
		expect(onSortChange).toHaveBeenLastCalledWith("latest");
	});
});

describe("Comment 受控回复焦点", () => {
	it("表单出现后跳过非文本控件、隐藏、禁用和只读输入，再次激活回复关闭并返回原入口", () => {
		render(<ReplyExample />);
		const reply = screen.getByRole("button", { name: "回复" });
		fireEvent.click(reply);
		const input = screen.getByRole("textbox", { name: "回复正文" });
		expect(document.activeElement).toBe(input);
		expect(reply.getAttribute("aria-expanded")).toBe("true");
		expect(
			document.getElementById(reply.getAttribute("aria-controls") ?? "")?.contains(input),
		).toBe(true);
		fireEvent.click(reply);
		expect(screen.queryByRole("textbox", { name: "回复正文" })).toBeNull();
		expect(document.activeElement).toBe(reply);
		expect(reply.getAttribute("aria-expanded")).toBe("false");
	});

	it("回复点击不自行生成表单，受控关闭也会在表单仍拥有焦点时返回入口", () => {
		const onReply = vi.fn();
		const { rerender } = render(
			<CommentItem {...identity} onReply={onReply}>
				正文
			</CommentItem>,
		);
		const reply = screen.getByRole("button", { name: "回复" });
		fireEvent.click(reply);
		expect(onReply).toHaveBeenCalledTimes(1);
		expect(screen.queryByRole("textbox")).toBeNull();
		rerender(
			<CommentItem
				{...identity}
				onReply={onReply}
				replyForm={<textarea aria-label="正文" />}
			/>,
		);
		expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "正文" }));
		rerender(<CommentItem {...identity} onReply={onReply} />);
		expect(document.activeElement).toBe(reply);
		expect(onReply).toHaveBeenCalledTimes(1);
	});

	it("卸载前的空目标失焦不会取消关闭后的焦点归还", () => {
		const onReply = vi.fn();
		const { rerender } = render(
			<CommentItem
				{...identity}
				onReply={onReply}
				replyForm={<textarea aria-label="草稿" />}
			/>,
		);
		const reply = screen.getByRole("button", { name: "回复" });
		const editor = screen.getByRole("textbox", { name: "草稿" });
		act(() => {
			editor.blur();
			rerender(<CommentItem {...identity} onReply={onReply} />);
		});
		expect(document.activeElement).toBe(reply);
	});

	it("表单更新不重聚焦，焦点移到外部后关闭不会抢回", () => {
		const onReply = vi.fn();
		const view = (open: boolean, text: string) => (
			<>
				<button type="button">外部操作</button>
				<CommentItem
					{...identity}
					onReply={onReply}
					replyForm={open && <textarea aria-label="回复正文" defaultValue={text} />}
				/>
			</>
		);
		const { rerender } = render(view(true, "草稿"));
		const outside = screen.getByRole("button", { name: "外部操作" });
		act(() => outside.focus());
		rerender(view(true, "更新后"));
		expect(document.activeElement).toBe(outside);
		rerender(view(false, ""));
		expect(document.activeElement).toBe(outside);
	});

	it("主动离焦到空白后不因后续表单关闭抢回焦点", async () => {
		const onReply = vi.fn();
		const { rerender } = render(
			<CommentItem
				{...identity}
				onReply={onReply}
				replyForm={<textarea aria-label="草稿" />}
			/>,
		);
		await act(async () => screen.getByRole("textbox", { name: "草稿" }).blur());
		expect(document.activeElement).toBe(document.body);
		rerender(<CommentItem {...identity} onReply={onReply} />);
		expect(document.activeElement).toBe(document.body);
	});

	it("支持 contenteditable 正文，并且表单没有输入时不抢现有焦点", () => {
		const onReply = vi.fn();
		const { rerender } = render(
			<>
				<button type="button">外部</button>
				<CommentItem {...identity} onReply={onReply} />
			</>,
		);
		const outside = screen.getByRole("button", { name: "外部" });
		act(() => outside.focus());
		rerender(
			<>
				<button type="button">外部</button>
				<CommentItem {...identity} onReply={onReply} replyForm={<p>等待编辑器</p>} />
			</>,
		);
		expect(document.activeElement).toBe(outside);
		rerender(<CommentItem {...identity} onReply={onReply} />);
		rerender(
			<CommentItem
				{...identity}
				onReply={onReply}
				replyForm={
					<div contentEditable role="textbox" aria-label="富文本回复" tabIndex={0} />
				}
			/>,
		);
		expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "富文本回复" }));
	});
});
