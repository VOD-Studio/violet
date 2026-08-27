/**
 * messagePreview 测试：侧边栏会话预览对人类可读，剥离内联图片占位符。
 */
import { describe, expect, it } from "vitest";
import type { ChatMessage } from "../../model/types";
import { messagePreview } from "../conversation";

function imageMessage(content?: string): ChatMessage {
	return {
		id: "m_img",
		conversation_id: "c_1",
		sender: { id: "u_1", username: "alice", display_name: "Alice", avatar_url: "" },
		type: "image",
		content,
		media: [
			{
				id: "media-1",
				url: "https://cdn.example.com/a.png",
				mime_type: "image/png",
				size: 1,
			},
		],
		reactions: [],
		is_deleted: false,
		created_at: "2026-08-25T08:00:00Z",
	};
}

function textMessage(content?: string): ChatMessage {
	return {
		id: "m_text",
		conversation_id: "c_1",
		sender: { id: "u_1", username: "alice", display_name: "Alice", avatar_url: "" },
		type: "text",
		content,
		reactions: [],
		is_deleted: false,
		created_at: "2026-08-25T08:00:00Z",
	};
}

describe("messagePreview", () => {
	it("图片消息预览剥离内联图片占位符，只留环绕文字", () => {
		expect(messagePreview(imageMessage("你好![img:media-1]世界"))).toBe("你好世界");
	});

	it("纯占位符或无说明时回退默认预览", () => {
		expect(messagePreview(imageMessage("![img:media-1]"))).toBe("发送了一张图片");
		expect(messagePreview(imageMessage(undefined))).toBe("发送了一张图片");
	});

	// 回归：自定义表情占位符 [name:uuid] 与图片占位符 ![img:id] 同为方括号形状，
	// 图片消息的图文混排 caption 里混入表情 token 时必须一并剥离，不能裸吐。
	it("图片消息预览同时剥离表情占位符（系统/自定义），只留环绕文字", () => {
		expect(messagePreview(imageMessage("你好[smile]世界"))).toBe("你好世界");
		expect(
			messagePreview(imageMessage("你好[1:00000000-0000-0000-0000-000000000001]世界")),
		).toBe("你好世界");
	});

	it("纯表情占位符也回退默认预览", () => {
		expect(messagePreview(imageMessage("[1:00000000-0000-0000-0000-000000000001]"))).toBe(
			"发送了一张图片",
		);
	});

	it("文本消息预览剥离表情占位符，只留环绕文字", () => {
		expect(messagePreview(textMessage("你好[smile]世界"))).toBe("你好世界");
	});

	it("纯表情占位符的文本消息回退默认预览", () => {
		expect(messagePreview(textMessage("[1:00000000-0000-0000-0000-000000000001]"))).toBe(
			"文本消息",
		);
	});
});
