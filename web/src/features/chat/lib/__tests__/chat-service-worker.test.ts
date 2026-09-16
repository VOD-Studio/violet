// @vitest-environment node
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";

it("连续收到相同标签的聊天推送时仍请求再次提醒", async () => {
	const listeners = new Map<string, (event: unknown) => void>();
	const showNotification = vi.fn().mockResolvedValue(undefined);
	runInNewContext(readFileSync("public/chat-sw.js", "utf8"), {
		self: {
			addEventListener: (type: string, listener: (event: unknown) => void) =>
				listeners.set(type, listener),
			registration: { showNotification },
		},
	});
	const pending: Promise<unknown>[] = [];
	for (const body of ["第一条消息", "第二条消息"]) {
		listeners.get("push")?.({
			data: { json: () => ({ body, tag: "violet-chat" }) },
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
