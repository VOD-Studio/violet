/**
 * MessageBubble 组件测试
 *
 * 回归：图片消息正文保留 ![img:id] 占位符（composer 按图切分发送），气泡渲染端
 * 把占位符还原为内联图片，实现与输入框一致的图文环绕；旧格式纯文字说明兼容前置渲染。
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChatMedia, ChatMessage } from "../../model/types";
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

function renderBubble(message: ChatMessage, onImage: (media: ChatMedia) => void = () => {}) {
	return render(
		<MessageBubble
			animateIn={false}
			currentUserID="u_1"
			emoteMap={{}}
			highlighted={false}
			layout={false}
			message={message}
			messageRef={() => {}}
			onImage={onImage}
			showSender
			showSenderName
		/>,
	);
}

afterEach(() => cleanup());

describe("MessageBubble", () => {
	it("图片消息占位符还原为内联图片，文字环绕且点击打开预览", () => {
		const onImage = vi.fn();
		const { container } = renderBubble(imageMessage("123![img:media-1]456"), onImage);

		const img = screen.getByAltText("聊天图片");
		const p = container.querySelector("p");
		expect(p?.childNodes[0]?.textContent).toBe("123");
		expect(p?.childNodes[2]?.textContent).toBe("456");
		fireEvent.click(img);
		expect(onImage).toHaveBeenCalledWith(media);
	});

	it("旧格式纯文字说明前置占位符内联渲染", () => {
		renderBubble(imageMessage("123123"));

		expect(screen.getByAltText("聊天图片")).toBeTruthy();
		expect(screen.getByText("123123")).toBeTruthy();
	});

	it("无说明图片消息只渲染内联图片，不泄漏占位符", () => {
		const { container } = renderBubble(imageMessage(undefined));

		expect(screen.getByAltText("聊天图片")).toBeTruthy();
		expect(container.textContent).not.toContain("![img:");
	});
});
