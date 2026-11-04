import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { BotReply, BotToolCall, ChatMessage } from "../../model/types";
import { BotReplyCard } from "../BotReplyCard";

afterEach(cleanup);

function botMessage(reply: Partial<BotReply> & { status: BotReply["status"] }): ChatMessage {
	const now = new Date().toISOString();
	return {
		id: "reply-tool",
		conversation_id: "conversation-1",
		sender: {
			id: "bot-1",
			username: "saber",
			display_name: "Saber",
			avatar_url: "",
			is_bot: true,
		},
		type: "text",
		content: "最终答案",
		bot_reply: { revision: 1, updated_at: now, ...reply },
		reactions: [],
		is_deleted: false,
		created_at: now,
	};
}

const toolCall: BotToolCall = {
	id: "call-1",
	name: "web_search",
	status: "completed",
	arguments: '{"q":"violet"}',
	result: "三条结果",
	duration_ms: 3100,
};

it("没有工具调用时不渲染工具调用区", () => {
	const { rerender } = render(
		<BotReplyCard message={botMessage({ status: "streaming" })} viewerID="viewer-1" />,
	);
	expect(screen.queryByRole("button", { name: /工具调用/ })).toBeNull();
	rerender(
		<BotReplyCard
			message={botMessage({ status: "streaming", tool_calls: [] })}
			viewerID="viewer-1"
		/>,
	);
	expect(screen.queryByRole("button", { name: /工具调用/ })).toBeNull();
});

it("工具调用默认收起，展开后展示名称、参数、结果、错误与耗时", async () => {
	render(
		<BotReplyCard
			message={botMessage({
				status: "completed",
				tool_calls: [
					toolCall,
					{
						id: "call-2",
						name: "web_fetch",
						status: "failed",
						error: "连接超时",
						duration_ms: 850,
					},
				],
			})}
			viewerID="viewer-1"
		/>,
	);
	const button = screen.getByRole("button", { name: /工具调用/ });
	expect(button.getAttribute("aria-expanded")).toBe("false");
	expect(button.textContent).toContain("2");
	expect(screen.queryByText("web_search")).toBeNull();
	fireEvent.click(button);
	expect(button.getAttribute("aria-expanded")).toBe("true");
	await waitFor(() => expect(screen.getByText("web_search").tagName).toBe("CODE"));
	expect(screen.getByText('{"q":"violet"}')).toBeTruthy();
	expect(screen.getByText("三条结果")).toBeTruthy();
	expect(screen.getByText("连接超时")).toBeTruthy();
	expect(screen.getAllByText("参数")).toHaveLength(1);
	expect(screen.getByText("结果")).toBeTruthy();
	expect(screen.getByText("错误")).toBeTruthy();
	expect(screen.getByText("3.1s")).toBeTruthy();
	expect(screen.getByText("850ms")).toBeTruthy();
});

it("按调用状态渲染转圈、完成与失败图标", async () => {
	const { container } = render(
		<BotReplyCard
			message={botMessage({
				status: "streaming",
				tool_calls: [
					{ name: "web_search", status: "running" },
					{ name: "web_fetch", status: "completed" },
					{ name: "js_sandbox", status: "failed", error: "语法错误" },
				],
			})}
			viewerID="viewer-1"
		/>,
	);
	fireEvent.click(screen.getByRole("button", { name: /工具调用/ }));
	await waitFor(() => expect(screen.getByText("运行中")).toBeTruthy());
	expect(screen.getByText("已完成")).toBeTruthy();
	expect(screen.getByText("失败")).toBeTruthy();
	expect(container.querySelector("svg.animate-spin")).toBeTruthy();
	expect(container.querySelector("svg.text-success")).toBeTruthy();
	expect(container.querySelector("svg.text-destructive")).toBeTruthy();
});

it("终态回复中的 running 调用显示未完成且不再转圈", async () => {
	const { container } = render(
		<BotReplyCard
			message={botMessage({
				status: "completed",
				tool_calls: [{ name: "web_search", status: "running", duration_ms: 1200 }],
			})}
			viewerID="viewer-1"
		/>,
	);
	fireEvent.click(screen.getByRole("button", { name: /工具调用/ }));
	await waitFor(() => expect(screen.getByText("未完成")).toBeTruthy());
	expect(container.querySelector("svg.animate-spin")).toBeNull();
	expect(container.querySelector("svg.text-warning")).toBeTruthy();
	expect(screen.queryByText("运行中")).toBeNull();
});

it("工具调用区展开后，新快照不会重新打开", async () => {
	const message = botMessage({
		status: "streaming",
		revision: 1,
		tool_calls: [{ name: "web_search", status: "running" }],
	});
	const { rerender } = render(<BotReplyCard message={message} viewerID="viewer-1" />);
	const button = screen.getByRole("button", { name: /工具调用/ });
	fireEvent.click(button);
	await waitFor(() => expect(screen.getByText("运行中")).toBeTruthy());
	fireEvent.click(button);
	expect(button.getAttribute("aria-expanded")).toBe("false");
	rerender(
		<BotReplyCard
			message={botMessage({
				status: "streaming",
				revision: 2,
				tool_calls: [
					{ name: "web_search", status: "completed" },
					{ name: "web_fetch", status: "running" },
				],
			})}
			viewerID="viewer-1"
		/>,
	);
	expect(screen.getByRole("button", { name: /工具调用/ }).getAttribute("aria-expanded")).toBe(
		"false",
	);
});

it("按 Bot 配置默认展开思考，手动收起后不被后续快照重新打开", async () => {
	const reply = {
		status: "streaming" as const,
		thinking: "分析问题",
		thinking_default_expanded: true,
		revision: 2,
		updated_at: new Date().toISOString(),
	};
	const message: ChatMessage = {
		id: "reply-1",
		conversation_id: "conversation-1",
		sender: {
			id: "bot-1",
			username: "saber",
			display_name: "Saber",
			avatar_url: "",
			is_bot: true,
		},
		type: "text",
		content: "**答案**",
		bot_reply: reply,
		reactions: [],
		is_deleted: false,
		created_at: new Date().toISOString(),
	};
	const { rerender, unmount } = render(<BotReplyCard message={message} viewerID="viewer-1" />);
	expect(screen.getByText("BOT")).toBeTruthy();
	expect(screen.getByRole("status").textContent).toContain("正在回复");
	expect(screen.getByText("答案").tagName).toBe("STRONG");
	await waitFor(() =>
		expect(screen.getByRole("button", { name: /思考过程/ }).getAttribute("aria-expanded")).toBe(
			"true",
		),
	);
	expect(screen.getByText("分析问题")).toBeTruthy();
	fireEvent.click(screen.getByRole("button", { name: /思考过程/ }));
	expect(screen.getByRole("button", { name: /思考过程/ }).getAttribute("aria-expanded")).toBe(
		"false",
	);
	rerender(
		<BotReplyCard
			message={{ ...message, bot_reply: { ...reply, thinking: "分析问题第二段" } }}
			viewerID="viewer-1"
		/>,
	);
	expect(screen.getByRole("button", { name: /思考过程/ }).getAttribute("aria-expanded")).toBe(
		"false",
	);
	fireEvent.click(screen.getByRole("button", { name: /思考过程/ }));
	await waitFor(() => expect(screen.getByText("分析问题第二段")).toBeTruthy());
	rerender(
		<BotReplyCard
			message={{
				...message,
				bot_reply: { ...reply, thinking: "分析问题第二段", status: "completed" },
			}}
			viewerID="viewer-1"
		/>,
	);
	expect(screen.queryByRole("status")).toBeNull();
	expect(screen.getByText("分析问题第二段")).toBeTruthy();
	unmount();
	render(
		<BotReplyCard
			message={{ ...message, bot_reply: { ...reply, status: "completed" } }}
			viewerID="viewer-1"
		/>,
	);
	expect(screen.getByRole("button", { name: /思考过程/ }).getAttribute("aria-expanded")).toBe(
		"true",
	);
	cleanup();
	render(
		<BotReplyCard
			message={{ ...message, bot_reply: { ...reply, thinking_default_expanded: false } }}
			viewerID="viewer-1"
		/>,
	);
	expect(screen.getByRole("button", { name: /思考过程/ }).getAttribute("aria-expanded")).toBe(
		"false",
	);
});
