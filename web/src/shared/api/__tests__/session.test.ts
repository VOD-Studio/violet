/**
 * session store 测试
 *
 * 验证会话活跃标志的标记/清除，以及 isSessionActive 的命令式读取。
 * zustand store 跨用例共享，故 beforeEach 重置。
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
	clearSessionActive,
	isSessionActive,
	markSessionActive,
	useSessionStore,
} from "../session";

describe("session store", () => {
	beforeEach(() => {
		// 重置为初始状态，避免用例间串扰
		useSessionStore.setState({ sessionActive: false });
	});

	it("初始状态为非活跃", () => {
		expect(useSessionStore.getState().sessionActive).toBe(false);
	});

	it("markSessionActive() 后状态变为活跃", () => {
		markSessionActive();
		expect(useSessionStore.getState().sessionActive).toBe(true);
	});

	it("clearSessionActive() 后状态变为非活跃", () => {
		markSessionActive();
		clearSessionActive();
		expect(useSessionStore.getState().sessionActive).toBe(false);
	});

	it("isSessionActive() 命令式读取与 store 状态一致", () => {
		expect(isSessionActive()).toBe(false);
		markSessionActive();
		expect(isSessionActive()).toBe(true);
		clearSessionActive();
		expect(isSessionActive()).toBe(false);
	});
});
