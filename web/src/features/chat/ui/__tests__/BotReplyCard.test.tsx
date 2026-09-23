import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { ChatMessage } from "../../model/types";
import { BotReplyCard } from "../BotReplyCard";

afterEach(cleanup);

it("同一卡片展示生成状态、Markdown 正文与可折叠思考", () => {
	const reply = {
		status: "streaming" as const,
		thinking: "分析问题",
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
	const { rerender } = render(<BotReplyCard message={message} viewerID="viewer-1" />);
	expect(screen.getByText("BOT")).toBeTruthy();
	expect(screen.getByRole("status").textContent).toContain("正在回复");
	expect(screen.getByText("答案").tagName).toBe("STRONG");
	expect(screen.queryByText("分析问题")).toBeNull();
	fireEvent.click(screen.getByRole("button", { name: /思考过程/ }));
	expect(screen.getByText("分析问题")).toBeTruthy();
	rerender(
		<BotReplyCard
			message={{ ...message, bot_reply: { ...reply, status: "completed" } }}
			viewerID="viewer-1"
		/>,
	);
	expect(screen.queryByRole("status")).toBeNull();
	expect(screen.getByText("分析问题")).toBeTruthy();
});
