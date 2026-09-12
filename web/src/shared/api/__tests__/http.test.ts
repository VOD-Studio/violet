import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../error";
import { createHttpClient } from "../http";
import { useLoginDialogStore } from "../login-dialog-store";
import { clearSessionActive, markSessionActive, useSessionStore } from "../session";
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

	it("游客收到 401 时保留错误，但不弹窗或触发会话过期", async () => {
		const onExpired = vi.fn();
		registerSessionExpiredHandler(onExpired);
		const client = createHttpClient();
		client.defaults.adapter = rejectWith401;

		await expect(client.get("/chat/conversations")).rejects.toMatchObject({ status: 401 });

		expect(useLoginDialogStore.getState().isOpen).toBe(false);
		expect(onExpired).not.toHaveBeenCalled();
	});

	it("已登录会话收到 401 时弹窗并清缓存，但保持 sessionActive 供原地重登", async () => {
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

	it("请求未返回时退出登录，迟到的 401 不重新打开弹窗", async () => {
		markSessionActive();
		const onExpired = vi.fn();
		registerSessionExpiredHandler(onExpired);
		const client = createHttpClient();
		let notifyStarted!: () => void;
		let respond!: () => void;
		const started = new Promise<void>((resolve) => {
			notifyStarted = resolve;
		});
		const response = new Promise<void>((resolve) => {
			respond = resolve;
		});
		client.defaults.adapter = async (config) => {
			notifyStarted();
			await response;
			return rejectWith401(config);
		};

		const request = client.get("/chat/conversations");
		const rejection = expect(request).rejects.toMatchObject({ status: 401 });
		await started;
		clearSessionActive();
		respond();
		await rejection;

		expect(useLoginDialogStore.getState().isOpen).toBe(false);
		expect(onExpired).not.toHaveBeenCalled();
	});

	it("__skipAuthDialog 的 401 不弹窗不触发 onSessionExpired", async () => {
		markSessionActive();
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
