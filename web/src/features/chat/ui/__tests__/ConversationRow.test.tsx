import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { ChatConversation, ChatUser } from "../../model/types";
import { ConversationRow } from "../ConversationIndex";

const user = (id: string, overrides: Partial<ChatUser> = {}): ChatUser => ({
	id,
	username: id,
	display_name: id,
	avatar_url: "",
	...overrides,
});

const direct = (peer: ChatUser): ChatConversation => ({
	id: "c1",
	kind: "direct",
	title: "",
	owner: user("me"),
	members: [
		{
			user: user("me"),
			role: "owner",
			joined_at: "2026-11-14T00:00:00Z",
			is_muted: false,
			online: false,
			can_speak: true,
		},
		{
			user: peer,
			role: "member",
			joined_at: "2026-11-14T00:00:00Z",
			is_muted: false,
			online: false,
			can_speak: true,
		},
	],
	unread_count: 0,
	created_at: "2026-11-14T00:00:00Z",
	updated_at: "2026-11-14T00:00:00Z",
});

afterEach(() => cleanup());

it("与角色的私信在名字旁标出“角色”，真人私信不标", () => {
	const { rerender } = render(
		<ConversationRow
			active={false}
			conversation={direct(user("claude", { is_bot: true, display_name: "Claude" }))}
			currentUserID="me"
			onClick={() => {}}
		/>,
	);
	expect(screen.getByText("角色")).toBeTruthy();
	rerender(
		<ConversationRow
			active={false}
			conversation={direct(user("momo", { display_name: "Momo" }))}
			currentUserID="me"
			onClick={() => {}}
		/>,
	);
	expect(screen.queryByText("角色")).toBeNull();
});
