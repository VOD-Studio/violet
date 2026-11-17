import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useChatTypingStore } from "../../model/chat-typing-store";
import type { ChatMember } from "../../model/types";
import { TypingIndicator } from "../TypingIndicator";

const members: ChatMember[] = ["一个很长很长的成员显示名称", "乙", "丙"].map((name, index) => ({
	user: { id: String(index), username: name, display_name: name, avatar_url: "" },
	role: "member",
	joined_at: "2026-11-17T00:00:00Z",
	is_muted: false,
	can_speak: true,
	online: false,
}));

beforeEach(() => {
	vi.useFakeTimers();
});
afterEach(() => {
	cleanup();
	for (const member of members) useChatTypingStore.getState().clearTyping("c1", member.user.id);
	vi.useRealTimers();
});

it("保留同一个状态位，真实输入状态从无人、一人、多人到过期清空", () => {
	render(<TypingIndicator conversationID="c1" members={members} />);
	const status = screen.getByRole("status");
	expect(status.textContent).toBe("");
	expect(status.tabIndex).toBe(-1);
	act(() => useChatTypingStore.getState().setTyping("c1", "0"));
	expect(status.textContent).toBe("一个很长很长的成员显示名称正在输入…");
	act(() => {
		useChatTypingStore.getState().setTyping("c1", "1");
		useChatTypingStore.getState().setTyping("c1", "2");
	});
	expect(status.textContent).toBe("一个很长很长的成员显示名称、乙等 3 人正在输入…");
	act(() => vi.advanceTimersByTime(6000));
	expect(screen.getByRole("status")).toBe(status);
	expect(status.textContent).toBe("");
	expect(status.tabIndex).toBe(-1);
});
