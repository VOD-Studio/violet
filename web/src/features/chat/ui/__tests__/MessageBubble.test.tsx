/**
 * MessageBubble 组件测试
 *
 * 回归：图片消息可携带说明文字（composer 图文合一发送，见 CONTEXT.md
 * 「图片消息」词条），气泡的图片形态必须渲染 content，不能只渲染图片。
 */
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "../../model/types";
import { MessageBubble } from "../MessageBubble";

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		to,
		params,
		children,
		...props
	}: {
		to: string;
		params?: { username?: string };
		children: ReactNode;
		"aria-label"?: string;
		className?: string;
	}) => (
		<a {...props} href={params?.username ? `/users/${params.username}` : to}>
			{children}
		</a>
	),
}));

vi.mock("../../api/queries", () => ({
	useAddChatMessageReaction: () => ({ mutate: vi.fn(), isPending: false }),
	useRemoveChatMessageReaction: () => ({ mutate: vi.fn(), isPending: false }),
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

const sender = {
	id: "u_1",
	username: "alice",
	display_name: "Alice",
	avatar_url: "",
};

const media = {
	id: "media-1",
	url: "https://cdn.example.com/a.png",
	mime_type: "image/png",
	size: 1,
};

function imageMessage(content?: string): ChatMessage {
	return {
		id: "m_img",
		conversation_id: "c_1",
		sender,
		type: "image",
		content,
		media,
		reactions: [],
		is_deleted: false,
		created_at: "2026-08-25T08:00:00Z",
	};
}

function renderBubble(message: ChatMessage) {
	return render(
		<MessageBubble
			animateIn={false}
			currentUserID="u_1"
			emoteMap={{}}
			highlighted={false}
			layout={false}
			message={message}
			messageRef={() => {}}
			onImage={vi.fn()}
			showSender
			showSenderName
		/>,
	);
}

afterEach(() => cleanup());

describe("MessageBubble", () => {
	it("带说明文字的图片消息同时渲染图片与文字", () => {
		renderBubble(imageMessage("123123"));

		expect(screen.getByAltText("聊天图片")).toBeTruthy();
		expect(screen.getByText("123123")).toBeTruthy();
	});

	it("无说明文字的图片消息只渲染图片，不产生空气泡", () => {
		const { container } = renderBubble(imageMessage(undefined));

		expect(screen.getByAltText("聊天图片")).toBeTruthy();
		// BubbleShell 根节点特征类；无 caption 时不应出现文字气泡
		expect(container.querySelector("div.leading-relaxed")).toBeNull();
	});
});
