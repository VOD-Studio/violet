/**
 * chat-typing-store 测试
 *
 * zustand store 跨用例共享 + 内部维护 setTimeout 句柄，故用 fake timers 隔离，
 * beforeEach/afterEach 重置状态与计时器，避免用例间串扰。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChatTypingStore } from "../chat-typing-store";

const conversationA = "conv-a";
const conversationB = "conv-b";
const alice = "user-alice";
const bob = "user-bob";

describe("useChatTypingStore", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		useChatTypingStore.setState({ typing: {} });
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("初始状态没有任何用户在输入", () => {
		expect(useChatTypingStore.getState().typing[conversationA]).toBeUndefined();
	});

	it("setTyping 后该用户出现在对应会话的输入列表中", () => {
		useChatTypingStore.getState().setTyping(conversationA, alice);
		expect(Object.keys(useChatTypingStore.getState().typing[conversationA] ?? {})).toEqual([
			alice,
		]);
	});

	it("clearTyping 显式移除，不等待超时", () => {
		useChatTypingStore.getState().setTyping(conversationA, alice);
		useChatTypingStore.getState().clearTyping(conversationA, alice);
		expect(useChatTypingStore.getState().typing[conversationA]?.[alice]).toBeUndefined();
	});

	it("超过 TTL 未刷新则自动移除", () => {
		useChatTypingStore.getState().setTyping(conversationA, alice);
		vi.advanceTimersByTime(5999);
		expect(useChatTypingStore.getState().typing[conversationA]?.[alice]).toBeDefined();
		vi.advanceTimersByTime(1);
		expect(useChatTypingStore.getState().typing[conversationA]?.[alice]).toBeUndefined();
	});

	it("重复 setTyping 从最近一次调用重新计算 TTL", () => {
		useChatTypingStore.getState().setTyping(conversationA, alice);
		vi.advanceTimersByTime(4000);
		useChatTypingStore.getState().setTyping(conversationA, alice);
		vi.advanceTimersByTime(4000);
		// 距首次调用已过 8000ms（超过 6000ms TTL），但距最近一次调用仅 4000ms，应仍在输入
		expect(useChatTypingStore.getState().typing[conversationA]?.[alice]).toBeDefined();
	});

	it("同一会话内多个用户互不影响", () => {
		useChatTypingStore.getState().setTyping(conversationA, alice);
		useChatTypingStore.getState().setTyping(conversationA, bob);
		useChatTypingStore.getState().clearTyping(conversationA, alice);
		const remaining = useChatTypingStore.getState().typing[conversationA] ?? {};
		expect(Object.keys(remaining)).toEqual([bob]);
	});

	it("不同会话之间互不影响", () => {
		useChatTypingStore.getState().setTyping(conversationA, alice);
		useChatTypingStore.getState().setTyping(conversationB, bob);
		expect(useChatTypingStore.getState().typing[conversationA]?.[alice]).toBeDefined();
		expect(useChatTypingStore.getState().typing[conversationA]?.[bob]).toBeUndefined();
		expect(useChatTypingStore.getState().typing[conversationB]?.[bob]).toBeDefined();
	});
});
