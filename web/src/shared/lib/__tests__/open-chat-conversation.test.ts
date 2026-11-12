import { afterEach, describe, expect, it, vi } from "vitest";
import { openChatConversation } from "../open-chat-conversation";

describe("openChatConversation", () => {
	afterEach(() => {
		window.history.replaceState({}, "", "/");
	});

	it("把会话写进 /chat 的 c 参数，并通知聊天页重新读取选中项", () => {
		const onPopState = vi.fn();
		window.addEventListener("popstate", onPopState);
		openChatConversation("a b");
		window.removeEventListener("popstate", onPopState);

		expect(window.location.pathname).toBe("/chat");
		expect(new URL(window.location.href).searchParams.get("c")).toBe("a b");
		expect(onPopState).toHaveBeenCalledTimes(1);
	});
});
