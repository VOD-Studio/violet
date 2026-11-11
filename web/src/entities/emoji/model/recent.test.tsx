import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { emojiKey, rememberEmoji, useRecentEmojiKeys } from "./recent";

const key = "violet:recent-emojis";
afterEach(() => {
	cleanup();
	localStorage.removeItem(key);
});

it("输入与回应共享最近十六项，重复选择移到最前，不混淆自定义 UUID", () => {
	const { result } = renderHook(useRecentEmojiKeys);
	act(() => {
		localStorage.removeItem(key);
		window.dispatchEvent(new StorageEvent("storage", { key }));
		for (let id = 1; id <= 20; id++) {
			rememberEmoji({ id, name: String(id), url: "" });
		}
		rememberEmoji({ id: 9, name: "9", url: "" });
	});
	expect(result.current).toHaveLength(16);
	expect(result.current[0]).toBe("system:9");
	expect(result.current[1]).toBe("system:20");
	expect(new Set(result.current).size).toBe(16);
	expect(JSON.parse(localStorage.getItem(key) ?? "[]")).toEqual(result.current);
	const customCat = { id: -1, name: "猫", url: "", custom_emoji_id: "cat-uuid" };
	const customDog = { id: -1, name: "狗", url: "", custom_emoji_id: "dog-uuid" };
	act(() => {
		rememberEmoji(customCat);
		rememberEmoji(customDog);
	});
	expect(result.current.slice(0, 2)).toEqual([emojiKey(customDog), emojiKey(customCat)]);
	expect(new Set(result.current.slice(0, 2)).size).toBe(2);
});

it("跨标签页更新校验存储边界，忽略非 ID 内容并去重", () => {
	const { result } = renderHook(useRecentEmojiKeys);
	act(() => {
		localStorage.setItem(
			key,
			JSON.stringify([
				null,
				{},
				"system:2",
				"system:2",
				"custom:cat-uuid",
				"https://untrusted.example",
			]),
		);
		window.dispatchEvent(new StorageEvent("storage", { key }));
	});
	expect(result.current).toEqual(["system:2", "custom:cat-uuid"]);
});

it("跨标签页清空本机记录后，所有已挂载入口立即清空", () => {
	const first = renderHook(useRecentEmojiKeys);
	const second = renderHook(useRecentEmojiKeys);
	act(() => rememberEmoji({ id: 1, name: "微笑", url: "" }));
	expect(first.result.current).toEqual(["system:1"]);
	expect(second.result.current).toEqual(["system:1"]);
	act(() => {
		localStorage.clear();
		window.dispatchEvent(new StorageEvent("storage", { key: null }));
	});
	expect(first.result.current).toEqual([]);
	expect(second.result.current).toEqual([]);
});
