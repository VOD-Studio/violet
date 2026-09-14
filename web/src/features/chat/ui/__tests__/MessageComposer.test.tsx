import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChatMember, ChatMessage } from "../../model/types";
import { MessageComposer } from "../MessageComposer";

const sendMocks = vi.hoisted(() => ({ mutateAsync: vi.fn() }));

vi.mock("../../api/queries", () => ({
	useSendChatMessage: () => ({ mutateAsync: sendMocks.mutateAsync, isPending: false }),
	useChatMembers: () => ({ data: members }),
}));
vi.mock("../../hooks/useChatTyping", () => ({
	useChatTypingBroadcaster: () => ({ notifyTyping: vi.fn(), notifyStopped: vi.fn() }),
}));
vi.mock("@features/emojis/api/queries", () => ({
	useAllEmojis: () => ({ data: [], isLoading: false }),
}));
vi.mock("@features/customemoji/api/queries", () => ({
	useMyCustomEmojis: () => ({ data: [], isLoading: false }),
}));
vi.mock("@features/emojis/api/mutations", () => ({
	useUploadEmoji: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@features/upload/hooks/use-chunked-upload", () => ({
	useChunkedUpload: () => ({ uploadFile: vi.fn() }),
}));

const selfID = "00000000-0000-0000-0000-000000000001";
const peerID = "00000000-0000-0000-0000-000000000002";
const sender = { id: peerID, username: "bob", display_name: "Bob", avatar_url: "" };

const members: ChatMember[] = [
	{
		user: { id: selfID, username: "alice", display_name: "Alice", avatar_url: "" },
		role: "member",
		joined_at: "2026-08-25T08:00:00Z",
		is_muted: false,
	},
	{ user: sender, role: "member", joined_at: "2026-08-25T08:00:00Z", is_muted: false },
];

function textMessage(content?: string): ChatMessage {
	return {
		id: "m_ref",
		conversation_id: "c_1",
		sender,
		type: "text",
		content,
		reactions: [],
		is_deleted: false,
		created_at: "2026-08-25T08:00:00Z",
	};
}

/** 在 contentEditable 里模拟「打完一段文字、光标停在末尾」的输入。 */
function typeInto(box: HTMLElement, text: string) {
	box.textContent = text;
	const range = document.createRange();
	range.setStart(box.firstChild as Text, text.length);
	range.collapse(true);
	const selection = window.getSelection();
	selection?.removeAllRanges();
	selection?.addRange(range);
	fireEvent.input(box);
}

afterEach(() => {
	cleanup();
	sendMocks.mutateAsync.mockReset();
});

describe("MessageComposer", () => {
	it("剥离表情占位符，不泄漏裸 token 文本", () => {
		render(
			<MessageComposer
				conversationID="c_1"
				currentUserID={selfID}
				onCancelReply={() => {}}
				pendingShare={null}
				replyTarget={textMessage("你好[1:00000000-0000-0000-0000-000000000001]世界")}
			/>,
		);

		expect(screen.getByText("你好世界")).toBeTruthy();
		expect(screen.queryByText(/\[1:/)).toBeNull();
	});

	it("回复预览把提及占位符还原成 @username，不泄漏裸 token", () => {
		render(
			<MessageComposer
				conversationID="c_1"
				currentUserID={selfID}
				onCancelReply={() => {}}
				pendingShare={null}
				replyTarget={textMessage(`@(bob:${peerID}) 你好`)}
			/>,
		);

		expect(screen.getByText("@bob 你好")).toBeTruthy();
		expect(screen.queryByText(/@\(bob:/)).toBeNull();
	});

	it("挂载后聚焦消息输入框", () => {
		render(
			<MessageComposer
				conversationID="c_1"
				currentUserID={selfID}
				onCancelReply={() => {}}
				pendingShare={null}
				replyTarget={null}
			/>,
		);

		expect(screen.getByRole("textbox")).toBe(document.activeElement);
	});

	it("选择回复目标后重新聚焦消息输入框", () => {
		const { rerender } = render(
			<>
				<button type="button">回复</button>
				<MessageComposer
					conversationID="c_1"
					currentUserID={selfID}
					onCancelReply={() => {}}
					pendingShare={null}
					replyTarget={null}
				/>
			</>,
		);
		screen.getByRole("button", { name: "回复" }).focus();

		rerender(
			<>
				<button type="button">回复</button>
				<MessageComposer
					conversationID="c_1"
					currentUserID={selfID}
					onCancelReply={() => {}}
					pendingShare={null}
					replyTarget={textMessage("原消息")}
				/>
			</>,
		);

		expect(screen.getByRole("textbox")).toBe(document.activeElement);
	});

	it("输入 @ 弹出会话成员候选，自己不在候选里", () => {
		render(
			<MessageComposer
				conversationID="c_1"
				currentUserID={selfID}
				onCancelReply={() => {}}
				pendingShare={null}
				replyTarget={null}
			/>,
		);

		typeInto(screen.getByRole("textbox"), "@");

		expect(screen.getByRole("option", { name: /Bob/ })).toBeTruthy();
		expect(screen.queryByRole("option", { name: /Alice/ })).toBeNull();
	});

	it("选中候选后发出的正文是提及占位符，而非用户名字面量", async () => {
		render(
			<MessageComposer
				conversationID="c_1"
				currentUserID={selfID}
				onCancelReply={() => {}}
				pendingShare={null}
				replyTarget={null}
			/>,
		);
		const box = screen.getByRole("textbox");
		typeInto(box, "@bo");

		fireEvent.click(screen.getByRole("option", { name: /Bob/ }));

		expect(box.querySelector("[data-mention]")?.textContent).toBe("@Bob");
		fireEvent.click(screen.getByRole("button", { name: "发送消息" }));
		await vi.waitFor(() => expect(sendMocks.mutateAsync).toHaveBeenCalled());
		expect(sendMocks.mutateAsync.mock.calls[0][0].input.content).toBe(`@(bob:${peerID})`);
	});

	it("候选浮层开着时按 Esc 只关浮层，不冒泡取消回复", () => {
		const onCancelReply = vi.fn();
		render(
			<MessageComposer
				conversationID="c_1"
				currentUserID={selfID}
				onCancelReply={onCancelReply}
				pendingShare={null}
				replyTarget={textMessage("原消息")}
			/>,
		);
		const box = screen.getByRole("textbox");
		typeInto(box, "@bo");

		fireEvent.keyDown(box, { key: "Escape" });

		expect(screen.queryByRole("option")).toBeNull();
		expect(onCancelReply).not.toHaveBeenCalled();
	});
});
