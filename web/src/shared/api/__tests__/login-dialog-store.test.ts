/**
 * login-dialog-store 测试
 *
 * 验证弹窗显隐状态的基本切换。zustand store 跨用例共享，故 beforeEach 重置。
 */
import { beforeEach, describe, expect, it } from "vitest";
import { useLoginDialogStore } from "../login-dialog-store";

describe("useLoginDialogStore", () => {
	beforeEach(() => {
		// 重置为初始状态，避免用例间串扰
		useLoginDialogStore.setState({ isOpen: false });
	});

	it("初始状态为关闭", () => {
		expect(useLoginDialogStore.getState().isOpen).toBe(false);
	});

	it("open() 后状态变为打开", () => {
		useLoginDialogStore.getState().open();
		expect(useLoginDialogStore.getState().isOpen).toBe(true);
	});

	it("close() 后状态变为关闭", () => {
		useLoginDialogStore.getState().open();
		useLoginDialogStore.getState().close();
		expect(useLoginDialogStore.getState().isOpen).toBe(false);
	});

	it("open() 再 open() 保持打开（幂等）", () => {
		useLoginDialogStore.getState().open();
		useLoginDialogStore.getState().open();
		expect(useLoginDialogStore.getState().isOpen).toBe(true);
	});
});
