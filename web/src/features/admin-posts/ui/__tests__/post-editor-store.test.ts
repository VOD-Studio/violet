/**
 * postEditorStore 测试
 *
 * Zen 专注模式偏好持久化：toggleZen/setZen 改 state，
 * persist middleware 在 jsdom 下用 localStorage 透传。
 */
import { beforeEach, describe, expect, it } from "vitest";
import { usePostEditorStore } from "../post-editor-store";

describe("postEditorStore", () => {
	beforeEach(() => {
		localStorage.clear();
		// 重置 store 到初始状态（persist 会从空 localStorage rehydrate）
		usePostEditorStore.setState({ zenMode: false });
	});

	it("初始 zenMode 为 false", () => {
		expect(usePostEditorStore.getState().zenMode).toBe(false);
	});

	it("toggleZen 翻转 zenMode", () => {
		usePostEditorStore.getState().toggleZen();
		expect(usePostEditorStore.getState().zenMode).toBe(true);
		usePostEditorStore.getState().toggleZen();
		expect(usePostEditorStore.getState().zenMode).toBe(false);
	});

	it("setZen 直接设置 zenMode", () => {
		usePostEditorStore.getState().setZen(true);
		expect(usePostEditorStore.getState().zenMode).toBe(true);
		usePostEditorStore.getState().setZen(false);
		expect(usePostEditorStore.getState().zenMode).toBe(false);
	});

	it("偏好持久化到 localStorage（persist name: post-editor）", () => {
		usePostEditorStore.getState().setZen(true);
		// persist 的 storage key 是 store name
		const raw = localStorage.getItem("post-editor");
		expect(raw).toBeTruthy();
		const parsed = JSON.parse(raw ?? "{}");
		// zustand v5 persist 默认结构 { state: {...}, version: 0 }
		expect(parsed.state?.zenMode).toBe(true);
	});
});
