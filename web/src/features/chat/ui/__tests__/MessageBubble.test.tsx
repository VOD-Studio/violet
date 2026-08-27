/**
 * MessageBubble 组件测试
 *
 * 回归：图片消息正文保留 ![img:id] 占位符，气泡渲染端把占位符还原为内联图片，
 * 实现与输入框一致的图文环绕；旧格式纯文字说明兼容前置渲染。
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
	useEditChatMessage: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@features/upload/hooks/use-chunked-upload", () => ({
	useChunkedUpload: () => ({ uploadFile: vi.fn() }),
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
		media: [media],
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

	it("一条消息多图：全部占位符各自还原为对应媒体", () => {
		const onImage = vi.fn();
		const mediaB = { ...media, id: "media-2", url: "https://cdn.example.com/b.png" };
		const message = {
			...imageMessage("123![img:media-1]456![img:media-2]789"),
			media: [media, mediaB],
		};
		const { container } = renderBubble(message, onImage);

		const imgs = container.querySelectorAll("img[alt='聊天图片']");
		expect(imgs.length).toBe(2);
		expect(imgs[0]?.getAttribute("src")).toBe("https://cdn.example.com/a.png");
		expect(imgs[1]?.getAttribute("src")).toBe("https://cdn.example.com/b.png");
		const p = container.querySelector("p");
		expect(p?.textContent).toBe("123456789");
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

	// 回归：回复预览没有 custom_emote 解析结果可查，自定义/系统表情占位符必须剥离，
	// 否则裸吐 [name:uuid] 形状的 token 文本（见 ReplyPreview）。
	it("回复预览剥离表情占位符，不泄漏裸 token 文本", () => {
		const message = imageMessage("123123");
		message.reply_to = {
			id: "m_ref",
			sender: { id: "u_2", username: "bob", display_name: "Bob", avatar_url: "" },
			type: "text",
			content: "你好[1:00000000-0000-0000-0000-000000000001]世界",
			is_deleted: false,
		};

		renderBubble(message);

		expect(screen.getByText("你好世界")).toBeTruthy();
		expect(screen.queryByText(/\[1:/)).toBeNull();
	});
});

describe("MessageBubble 消息编辑", () => {
	function textMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
		return {
			id: "m_txt",
			conversation_id: "c_1",
			sender,
			type: "text",
			content: "原始内容",
			reactions: [],
			is_deleted: false,
			created_at: "2026-08-25T08:00:00Z",
			...overrides,
		};
	}

	it("edited_at 存在时时间戳前展示「已编辑」标识，悬停可见编辑时间", () => {
		renderBubble(textMessage({ edited_at: "2026-08-25T09:30:00Z" }));

		const badge = screen.getByText(/已编辑/);
		expect(badge.getAttribute("title")).toContain("编辑于");
	});

	it("未编辑的消息不展示「已编辑」标识", () => {
		renderBubble(textMessage());

		expect(screen.queryByText(/已编辑/)).toBeNull();
	});

	it("自己的消息有编辑入口，他人消息没有", () => {
		renderBubble(textMessage());
		expect(screen.getByLabelText("编辑消息")).toBeTruthy();
		cleanup();

		renderBubble(
			textMessage({
				sender: { id: "u_2", username: "bob", display_name: "Bob", avatar_url: "" },
			}),
		);
		expect(screen.queryByLabelText("编辑消息")).toBeNull();
	});

	it("点击编辑进入内联编辑模式，Esc 退出还原气泡", () => {
		const { container } = renderBubble(textMessage());

		fireEvent.click(screen.getByLabelText("编辑消息"));
		const editor = container.querySelector('[contenteditable="true"]');
		expect(editor).toBeTruthy();
		expect(screen.getByLabelText("保存编辑")).toBeTruthy();

		fireEvent.keyDown(editor as HTMLElement, { key: "Escape" });
		expect(container.querySelector('[contenteditable="true"]')).toBeNull();
		expect(screen.getByText("原始内容")).toBeTruthy();
	});
});
