import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { useChatPresenceStore } from "../../model/chat-presence-store";
import type { ChatConversation, ChatMember, ChatUser } from "../../model/types";
import { ConversationStatusLine } from "../ConversationStatusLine";

const user = (id: string, overrides: Partial<ChatUser> = {}): ChatUser => ({
	id,
	username: id,
	display_name: id,
	avatar_url: "",
	...overrides,
});

const member = (
	id: string,
	overrides: Partial<ChatMember> & { bot?: boolean } = {},
): ChatMember => ({
	user: user(id, { is_bot: overrides.bot }),
	role: "member",
	joined_at: "2026-11-14T00:00:00Z",
	is_muted: false,
	online: false,
	can_speak: true,
	...overrides,
});

const conversation = (kind: "room" | "direct"): ChatConversation => ({
	id: "c1",
	kind,
	title: kind === "room" ? "大厅" : "",
	owner: user("me"),
	unread_count: 0,
	created_at: "2026-11-14T00:00:00Z",
	updated_at: "2026-11-14T00:00:00Z",
});

beforeEach(() => useChatPresenceStore.getState().reset());
afterEach(() => cleanup());

it("群聊显示在线人数与在场角色数，角色不计入在线", () => {
	render(
		<ConversationStatusLine
			conversation={conversation("room")}
			currentUserID="me"
			members={[
				member("me", { online: true, can_speak: true }),
				member("amy", { online: true, can_speak: true }),
				member("bob"),
				member("rua", { bot: true }),
				member("saber", { bot: true }),
			]}
		/>,
	);
	expect(screen.getByText("2 人在线 · 2 个角色在场")).toBeTruthy();
});

it("没有角色时不显示角色段，静音时追加已静音", () => {
	render(
		<ConversationStatusLine
			conversation={conversation("room")}
			currentUserID="me"
			members={[
				member("me", { online: true, can_speak: true, is_muted: true }),
				member("amy"),
			]}
		/>,
	);
	expect(screen.getByText("1 人在线 · 已静音")).toBeTruthy();
});

it("私信按对方状态显示在线或离线，对方是角色时显示角色", () => {
	const { rerender } = render(
		<ConversationStatusLine
			conversation={conversation("direct")}
			currentUserID="me"
			members={[
				member("me", { online: true, can_speak: true }),
				member("amy", { online: true, can_speak: true }),
			]}
		/>,
	);
	expect(screen.getByText("在线")).toBeTruthy();
	rerender(
		<ConversationStatusLine
			conversation={conversation("direct")}
			currentUserID="me"
			members={[member("me", { online: true, can_speak: true }), member("amy")]}
		/>,
	);
	expect(screen.getByText("离线")).toBeTruthy();
	rerender(
		<ConversationStatusLine
			conversation={conversation("direct")}
			currentUserID="me"
			members={[
				member("me", { online: true, can_speak: true }),
				member("rua", { bot: true }),
			]}
		/>,
	);
	expect(screen.getByText("角色")).toBeTruthy();
});

it("实时事件覆盖成员读模型里的在线状态", () => {
	render(
		<ConversationStatusLine
			conversation={conversation("room")}
			currentUserID="me"
			members={[member("me", { online: true, can_speak: true }), member("amy")]}
		/>,
	);
	expect(screen.getByText("1 人在线")).toBeTruthy();
	act(() => useChatPresenceStore.getState().setOnline("amy", true));
	expect(screen.getByText("2 人在线")).toBeTruthy();
});

it("当前用户自己总是在线：重连快照早于服务端登记连接时也不少算", () => {
	render(
		<ConversationStatusLine
			conversation={conversation("room")}
			currentUserID="me"
			members={[member("me"), member("amy", { online: true })]}
		/>,
	);
	expect(screen.getByText("2 人在线")).toBeTruthy();
});
