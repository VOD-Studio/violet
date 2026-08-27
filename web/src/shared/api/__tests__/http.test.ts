/**
 * http 401 拦截器测试
 *
 * 401 时应清 auth 缓存（onSessionExpired）并弹登录框，但不动 sessionActive：
 * 该标志只随登录成功/登出/取消重登翻转（见 session.ts），一次瞬态 401
 * （会话实际仍有效）不应把客户端打成持久登出态；真过期时用户在弹窗里
 * 取消重登，由 LoginDialog 调 clearSessionActive。
 */
import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../error";
import { createHttpClient } from "../http";
import { useLoginDialogStore } from "../login-dialog-store";
import { markSessionActive, useSessionStore } from "../session";
import { registerSessionExpiredHandler } from "../session-expired";

function rejectWith401(config: InternalAxiosRequestConfig) {
	return Promise.reject(
		new AxiosError(
			"Request failed with status code 401",
			"ERR_BAD_REQUEST",
			config,
			{},
			{
				status: 401,
				statusText: "Unauthorized",
				headers: {},
				config,
				data: { error: "UNAUTHORIZED", message: "登录状态已过期" },
			},
		),
	);
}

describe("http 401 拦截器", () => {
	beforeEach(() => {
		useSessionStore.setState({ sessionActive: false, sessionVersion: 0 });
		useLoginDialogStore.setState({ isOpen: false });
		registerSessionExpiredHandler(() => {});
	});

	it("401 弹登录框并触发 onSessionExpired，但保持 sessionActive", async () => {
		markSessionActive();
		const onExpired = vi.fn();
		registerSessionExpiredHandler(onExpired);
		const client = createHttpClient();
		client.defaults.adapter = rejectWith401;

		await expect(client.get("/chat/conversations")).rejects.toBeInstanceOf(ApiError);

		expect(useLoginDialogStore.getState().isOpen).toBe(true);
		expect(onExpired).toHaveBeenCalledOnce();
		expect(useSessionStore.getState().sessionActive).toBe(true);
	});

	it("__skipAuthDialog 的 401 不弹窗不触发 onSessionExpired", async () => {
		const onExpired = vi.fn();
		registerSessionExpiredHandler(onExpired);
		const client = createHttpClient();
		client.defaults.adapter = rejectWith401;

		await expect(client.get("/auth/me", { __skipAuthDialog: true })).rejects.toBeInstanceOf(
			ApiError,
		);

		expect(useLoginDialogStore.getState().isOpen).toBe(false);
		expect(onExpired).not.toHaveBeenCalled();
	});
});
