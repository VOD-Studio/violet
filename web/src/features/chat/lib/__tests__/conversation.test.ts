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
		media: {
			id: "media-1",
			url: "https://cdn.example.com/a.png",
			mime_type: "image/png",
			size: 1,
		},
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
});
