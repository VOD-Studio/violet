// @vitest-environment node
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";

/** 在隔离 vm 中加载 push-sw.js，返回其注册的监听器与 showNotification 间谍。 */
const loadServiceWorker = () => {
	const listeners = new Map<string, (event: unknown) => void>();
	const showNotification = vi.fn().mockResolvedValue(undefined);
	runInNewContext(readFileSync("public/push-sw.js", "utf8"), {
		self: {
			addEventListener: (type: string, listener: (event: unknown) => void) =>
				listeners.set(type, listener),
			registration: { showNotification },
		},
	});
	return { listeners, showNotification };
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
