import { describe, expect, it } from "vitest";
import type { ChatConversation, ChatMessage, ChatUser } from "../../model/types";
import { toChatAlert, toChatEntry } from "../chat-inbox";

const ME: ChatUser = { id: "me", username: "xunrua", display_name: "xunrua", avatar_url: "" };
const CLAUDE: ChatUser = {
	id: "bot",
	username: "claude",
	display_name: "Claude",
	avatar_url: "/claude.png",
	is_bot: true,
};

function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
	return {
		id: "m1",
		conversation_id: "c1",
		sender: CLAUDE,
		type: "text",
		content: "摘要已经整理好了",
		reactions: [],
		is_deleted: false,
		created_at: "2026-11-09T09:58:00+08:00",
		...overrides,
	};
}

function conversation(overrides: Partial<ChatConversation> = {}): ChatConversation {
	return {
		id: "c1",
		kind: "direct",
		title: "",
		owner: ME,
		members: [
			{ user: ME, role: "owner", joined_at: "2026-11-01T00:00:00Z", is_muted: false },
			{ user: CLAUDE, role: "member", joined_at: "2026-11-01T00:00:00Z", is_muted: false },
		],
		last_message: message(),
		unread_count: 2,
		created_at: "2026-11-01T00:00:00Z",
		updated_at: "2026-11-09T09:58:00+08:00",
		...overrides,
	};
}

describe("toChatEntry", () => {
	it("私聊以对方为名与头像，带最新一条与未读数", () => {
		expect(toChatEntry(conversation(), ME.id)).toMatchObject({
			id: "c1",
			name: "Claude",
			avatar: "/claude.png",
			preview: "摘要已经整理好了",
			unread: 2,
		});
	});

	it("还没有消息的会话给出空会话提示，没有头像地址时不传空串", () => {
		const entry = toChatEntry(
			conversation({
				last_message: undefined,
				members: [
					{ user: ME, role: "owner", joined_at: "", is_muted: false },
					{
						user: { ...CLAUDE, avatar_url: "" },
						role: "member",
						joined_at: "",
						is_muted: false,
					},
				],
			}),
			ME.id,
		);
		expect(entry.preview).toBe("还没有消息");
		expect(entry.avatar).toBeUndefined();
	});
});

describe("toChatAlert", () => {
	it("回复的是我的消息：说回复了你", () => {
		const reply = message({
			reply_to: { id: "m0", sender: ME, type: "text", content: "你好", is_deleted: false },
		});
		expect(toChatAlert(conversation({ last_message: reply }), reply, ME.id)).toEqual({
			conversationId: "c1",
			name: "Claude",
			avatar: "/claude.png",
			action: "回复了你",
			preview: "摘要已经整理好了",
		});
	});

	it("私聊里普通消息：发来一条消息；房间里带房间名", () => {
		const direct = conversation();
		expect(toChatAlert(direct, message(), ME.id).action).toBe("发来一条消息");
		const room = conversation({ kind: "room", title: "周末骑行" });
		expect(toChatAlert(room, message(), ME.id).action).toBe("在「周末骑行」发言");
	});
});
