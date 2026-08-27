/**
 * MessageComposer 回复 banner 测试
 *
 * 回归：回复 banner 展示 replyTarget 的正文预览，没有 custom_emote 解析结果可查，
 * 自定义/系统表情占位符必须剥离，否则裸吐 `[name:uuid]` 形状的 token 文本。
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "../../model/types";
import { MessageComposer } from "../MessageComposer";

vi.mock("../../api/queries", () => ({
	useSendChatMessage: () => ({ mutateAsync: vi.fn(), isPending: false }),
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

const sender = { id: "u_2", username: "bob", display_name: "Bob", avatar_url: "" };

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

afterEach(() => cleanup());

describe("MessageComposer 回复 banner", () => {
	it("剥离表情占位符，不泄漏裸 token 文本", () => {
		render(
			<MessageComposer
				conversationID="c_1"
				onCancelReply={() => {}}
				pendingShare={null}
				replyTarget={textMessage("你好[1:00000000-0000-0000-0000-000000000001]世界")}
			/>,
		);

		expect(screen.getByText("你好世界")).toBeTruthy();
		expect(screen.queryByText(/\[1:/)).toBeNull();
	});
});
