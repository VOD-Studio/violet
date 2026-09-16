import { useSessionStore } from "@shared/api/session";
import { createImageUploadTask, type UploadedImage } from "@shared/lib/image-upload-task";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { sendChatMessage } from "../../api/client";
import { chatKeys } from "../../api/keys";
import {
	type ChatSendRequest,
	clearChatOutbox,
	enqueueChatMessage,
	reconcileChatOutbox,
	retryChatMessage,
	useChatOutbox,
} from "../chat-outbox";
import type { ChatMessage } from "../types";

vi.mock("../../api/client", () => ({ sendChatMessage: vi.fn() }));
const sender = { id: "self", username: "alice", display_name: "Alice", avatar_url: "" };
let qc: QueryClient;
function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<T>((yes, no) => {
		resolve = yes;
		reject = no;
	});
	return { promise, resolve, reject };
}
function request(key = "k", content = "hello"): ChatSendRequest {
	return { id: "c1", input: { type: "text", content }, idempotencyKey: key, draft: { sender } };
}
function response(key = "k"): ChatMessage {
	return {
		id: `server-${key}`,
		client_message_id: key,
		conversation_id: "c1",
		sender,
		type: "text",
		content: "hello",
		reactions: [],
		is_deleted: false,
		created_at: "2026-09-16T01:00:00Z",
	};
}
function imageResult(id: string): UploadedImage {
	return { id, url: `/${id}.png`, width: 10, height: 10, size: 5 };
}
beforeEach(() => {
	qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	qc.setQueryData(chatKeys.messages("c1"), {
		pages: [{ data: [], pagination: { limit: 50 } }],
		pageParams: [""],
	});
	useSessionStore.getState().markSessionActive();
	vi.mocked(sendChatMessage).mockReset();
});
afterEach(() => {
	clearChatOutbox();
	qc.clear();
	vi.restoreAllMocks();
});

it("连续发送相同文字独立进入列表，响应逆序也不串消息", async () => {
	const first = deferred<ChatMessage>(),
		second = deferred<ChatMessage>();
	vi.mocked(sendChatMessage)
		.mockReturnValueOnce(first.promise)
		.mockReturnValueOnce(second.promise);
	const one = enqueueChatMessage(qc, request("one"));
	const two = enqueueChatMessage(qc, request("two"));
	expect(useChatOutbox.getState().entries.map((item) => item.status)).toEqual([
		"sending",
		"sending",
	]);
	second.resolve(response("two"));
	await two;
	expect(
		useChatOutbox
			.getState()
			.entries.filter((item) => item.status !== "sent")
			.map((item) => item.request.idempotencyKey),
	).toEqual(["one"]);
	first.resolve(response("one"));
	await one;
	reconcileChatOutbox([response("one"), response("two")]);
	expect(useChatOutbox.getState().entries).toHaveLength(0);
});

it("失败保留消息，重复点击重试仍复用幂等键且只发一次", async () => {
	vi.mocked(sendChatMessage).mockRejectedValueOnce(new Error("offline"));
	await enqueueChatMessage(qc, request());
	expect(useChatOutbox.getState().entries[0]).toMatchObject({
		status: "failed",
		message: { content: "hello" },
	});
	const retry = deferred<ChatMessage>();
	vi.mocked(sendChatMessage).mockReturnValueOnce(retry.promise);
	const running = retryChatMessage(qc, "k");
	await retryChatMessage(qc, "k");
	expect(sendChatMessage).toHaveBeenCalledTimes(2);
	expect(vi.mocked(sendChatMessage).mock.calls.map((args) => args[2])).toEqual(["k", "k"]);
	retry.resolve(response());
	await running;
	reconcileChatOutbox([response()]);
	expect(useChatOutbox.getState().entries).toHaveLength(0);
});

it("图片先显示本地预览，原任务继续上传并替换正文中的媒体 ID", async () => {
	const upload = deferred<UploadedImage>();
	let report!: (percent: number) => void;
	const task = createImageUploadTask(
		new File(["image"], "photo.png", { type: "image/png" }),
		(_file, progress) => {
			report = progress;
			return upload.promise;
		},
	);
	const releaseInput = task.retain();
	const inInput = task.upload();
	const revoke = vi.spyOn(URL, "revokeObjectURL");
	vi.mocked(sendChatMessage).mockResolvedValue(response());
	const sent = enqueueChatMessage(qc, {
		...request(),
		input: { type: "image", content: "前![img:local]后" },
		images: [{ id: "local", task }],
	});
	releaseInput();
	expect(revoke).not.toHaveBeenCalled();
	expect(useChatOutbox.getState().entries[0]).toMatchObject({
		status: "uploading",
		message: { media: [{ url: task.previewURL }] },
	});
	expect(sendChatMessage).not.toHaveBeenCalled();
	report(50);
	expect(useChatOutbox.getState().entries[0].progress).toBe(50);
	upload.resolve(imageResult("media"));
	await inInput;
	await sent;
	reconcileChatOutbox([response()]);
	expect(sendChatMessage).toHaveBeenCalledWith(
		"c1",
		{ type: "image", content: "前![img:media]后", media_ids: ["media"] },
		"k",
	);
	expect(revoke).toHaveBeenCalledWith(task.previewURL);
});

it("多图部分失败仅重传失败图片，消息提交失败不重新上传", async () => {
	const uploadA = vi.fn().mockResolvedValue(imageResult("a"));
	const uploadB = vi
		.fn()
		.mockRejectedValueOnce(new Error("offline"))
		.mockResolvedValue(imageResult("b"));
	const a = createImageUploadTask(new File(["a"], "a.png"), uploadA);
	const b = createImageUploadTask(new File(["b"], "b.png"), uploadB);
	await enqueueChatMessage(qc, {
		...request(),
		input: { type: "image", content: "![img:a]![img:b]" },
		images: [
			{ id: "a", task: a },
			{ id: "b", task: b },
		],
	});
	expect(sendChatMessage).not.toHaveBeenCalled();
	expect(useChatOutbox.getState().entries[0].status).toBe("failed");
	vi.mocked(sendChatMessage).mockRejectedValueOnce(new Error("timeout"));
	await retryChatMessage(qc, "k");
	vi.mocked(sendChatMessage).mockResolvedValue(response());
	await retryChatMessage(qc, "k");
	expect(uploadA).toHaveBeenCalledTimes(1);
	expect(uploadB).toHaveBeenCalledTimes(2);
	expect(sendChatMessage).toHaveBeenCalledTimes(2);
});

it("SSE 列表先确认消息，迟到的 HTTP 错误不会将它改为失败", async () => {
	const http = deferred<ChatMessage>();
	vi.mocked(sendChatMessage).mockReturnValue(http.promise);
	const sending = enqueueChatMessage(qc, request());
	reconcileChatOutbox([{ ...response(), conversation_id: "other" }]);
	expect(useChatOutbox.getState().entries).toHaveLength(1);
	reconcileChatOutbox([response()]);
	expect(useChatOutbox.getState().entries).toHaveLength(0);
	http.reject(new Error("timeout"));
	await sending;
	expect(useChatOutbox.getState().entries).toHaveLength(0);
});

it("退出登录释放附件，旧上传完成后不向新会话发送消息", async () => {
	const upload = deferred<UploadedImage>();
	const task = createImageUploadTask(new File(["image"], "image.png"), () => upload.promise);
	const revoke = vi.spyOn(URL, "revokeObjectURL");
	const sending = enqueueChatMessage(qc, {
		...request(),
		input: { type: "image" },
		images: [{ id: "local", task }],
	});
	useSessionStore.getState().clearSessionActive();
	useSessionStore.getState().markSessionActive();
	expect(useChatOutbox.getState().entries).toHaveLength(0);
	expect(revoke).toHaveBeenCalledWith(task.previewURL);
	upload.resolve(imageResult("media"));
	await sending;
	expect(sendChatMessage).not.toHaveBeenCalled();
});

it("离开未加载消息的会话后仍能保留发送成功结果", async () => {
	qc.removeQueries({ queryKey: chatKeys.messages("c1") });
	vi.mocked(sendChatMessage).mockResolvedValue(response());
	await enqueueChatMessage(qc, request());
	expect(useChatOutbox.getState().entries[0]).toMatchObject({
		status: "sent",
		message: { id: "server-k" },
	});
	reconcileChatOutbox([response()]);
	expect(useChatOutbox.getState().entries).toHaveLength(0);
});
