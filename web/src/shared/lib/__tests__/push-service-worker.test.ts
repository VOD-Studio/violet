// @vitest-environment node
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";

/** 在隔离 vm 中加载 push-sw.js，返回其注册的监听器与 showNotification 间谍。 */
const loadServiceWorker = (script = "push-sw.js") => {
	const listeners = new Map<string, (event: unknown) => void>();
	const showNotification = vi.fn().mockResolvedValue(undefined);
	const skipWaiting = vi.fn().mockResolvedValue(undefined);
	const claim = vi.fn().mockResolvedValue(undefined);
	const context = {
		importScripts: (url: string) =>
			runInNewContext(readFileSync(`public${url}`, "utf8"), context),
		self: {
			addEventListener: (type: string, listener: (event: unknown) => void) =>
				listeners.set(type, listener),
			registration: { showNotification },
			skipWaiting,
			clients: { claim },
		},
	};
	runInNewContext(readFileSync(`public/${script}`, "utf8"), context);
	return { listeners, showNotification, skipWaiting, claim };
};

it("连续收到相同标签的推送时仍请求再次提醒", async () => {
	const { listeners, showNotification } = loadServiceWorker();
	const pending: Promise<unknown>[] = [];
	for (const body of ["第一条消息", "第二条消息"]) {
		listeners.get("push")?.({
			data: { json: () => ({ title: "Violet 聊天", body, tag: "violet-chat" }) },
			waitUntil: (promise: Promise<unknown>) => pending.push(promise),
		});
	}
	await Promise.all(pending);
	expect(showNotification).toHaveBeenCalledTimes(2);
	expect(showNotification).toHaveBeenLastCalledWith(
		"Violet 聊天",
		expect.objectContaining({ body: "第二条消息", tag: "violet-chat", renotify: true }),
	);
});

it("站内通知推送透传服务端下发的标题、标签与落地路径", async () => {
	const { listeners, showNotification } = loadServiceWorker();
	const pending: Promise<unknown>[] = [];
	listeners.get("push")?.({
		data: {
			json: () => ({
				title: "Alice 赞了你的推文",
				body: "今天写了点代码",
				url: "/tweets/abc",
				tag: "violet-notification-tweet_liked",
			}),
		},
		waitUntil: (promise: Promise<unknown>) => pending.push(promise),
	});
	await Promise.all(pending);
	expect(showNotification).toHaveBeenCalledWith(
		"Alice 赞了你的推文",
		expect.objectContaining({
			body: "今天写了点代码",
			tag: "violet-notification-tweet_liked",
			data: { url: "/tweets/abc" },
		}),
	);
});

it.each(["push-sw.js", "chat-sw.js"])("%s 自动接替旧 Worker 并保留推送处理", async (script) => {
	const { listeners, skipWaiting, claim } = loadServiceWorker(script);
	const pending: Promise<unknown>[] = [];
	for (const type of ["install", "activate"]) {
		listeners.get(type)?.({ waitUntil: (promise: Promise<unknown>) => pending.push(promise) });
	}
	await Promise.all(pending);
	expect(skipWaiting).toHaveBeenCalledOnce();
	expect(claim).toHaveBeenCalledOnce();
	expect(listeners.has("push")).toBe(true);
	expect(listeners.has("notificationclick")).toBe(true);
});
