import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { ChatMessage } from "../../model/types";
import { BotReplyCard } from "../BotReplyCard";

afterEach(cleanup);

it("生成时自动展开思考，手动收起后不被后续快照重新打开", async () => {
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
		"false",
	);
});
