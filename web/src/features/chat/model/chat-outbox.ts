import { useSessionStore } from "@shared/api/session";
import type { PagedResponse } from "@shared/api/types";
import type { ImageUploadReference } from "@shared/lib/image-upload-task";
import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import { create } from "zustand";
import { sendChatMessage } from "../api/client";
import { chatKeys } from "../api/keys";
import type { ChatMessage, SendMessageInput } from "./types";

export interface ChatSendRequest {
	id: string;
	input: SendMessageInput;
	idempotencyKey: string;
	draft: Pick<ChatMessage, "sender" | "reply_to" | "shared_tweet" | "custom_emote" | "mentions">;
	images?: ImageUploadReference[];
}

export interface OutgoingMessage {
	message: ChatMessage;
	request: ChatSendRequest;
	status: "uploading" | "sending" | "failed" | "sent";
	progress: number;
	error?: string;
	release: () => void;
}

export const useChatOutbox = create<{ entries: OutgoingMessage[] }>(() => ({ entries: [] }));

function remove(key: string) {
	const entry = useChatOutbox
		.getState()
		.entries.find((item) => item.request.idempotencyKey === key);
	if (!entry) return;
	entry.release();
	useChatOutbox.setState(({ entries }) => ({
		entries: entries.filter((item) => item !== entry),
	}));
}

function update(key: string, patch: Partial<OutgoingMessage>) {
	useChatOutbox.setState(({ entries }) => ({
		entries: entries.map((item) =>
			item.request.idempotencyKey === key ? { ...item, ...patch } : item,
		),
	}));
}

/** 服务端列表确认可先于 POST 返回；同一消息只保留服务端版本。 */
export function reconcileChatOutbox(messages: ChatMessage[]) {
	for (const message of messages) {
		const entry = useChatOutbox
			.getState()
			.entries.find(
				(item) =>
					item.request.idempotencyKey === message.client_message_id &&
					item.request.id === message.conversation_id &&
					item.message.sender.id === message.sender.id,
			);
		if (entry) remove(entry.request.idempotencyKey);
	}
}

export function clearChatOutbox() {
	for (const entry of useChatOutbox.getState().entries) entry.release();
	useChatOutbox.setState({ entries: [] });
}

useSessionStore.subscribe((state, previous) => {
	if (state.sessionVersion !== previous.sessionVersion) clearChatOutbox();
});

/** 同步接管附件并插入本地气泡，然后独立完成上传与发送。 */
export function enqueueChatMessage(qc: QueryClient, request: ChatSendRequest): Promise<void> {
	if (
		useChatOutbox
			.getState()
			.entries.some((item) => item.request.idempotencyKey === request.idempotencyKey)
	)
		return Promise.resolve();
	const images = request.images ?? [];
	const releases = images.map(({ task }) => task.retain());
	const message: ChatMessage = {
		...request.draft,
		id: `local:${request.idempotencyKey}`,
		client_message_id: request.idempotencyKey,
		conversation_id: request.id,
		type: request.input.type,
		content: request.input.content,
		media: images.map(({ id, task }) => ({
			id,
			url: task.result?.url ?? task.previewURL,
			mime_type: task.file.type,
			size: task.file.size,
			width: task.result?.width,
			height: task.result?.height,
		})),
		reactions: [],
		is_deleted: false,
		created_at: new Date().toISOString(),
	};
	const entry: OutgoingMessage = {
		message,
		request,
		status: images.some(({ task }) => !task.result) ? "uploading" : "sending",
		progress: 0,
		release: () => {
			for (const release of releases) release();
		},
	};
	useChatOutbox.setState(({ entries }) => ({ entries: [...entries, entry] }));
	return deliver(qc, entry);
}

export function retryChatMessage(qc: QueryClient, key: string): Promise<void> {
	const entry = useChatOutbox
		.getState()
		.entries.find((item) => item.request.idempotencyKey === key);
	if (entry?.status !== "failed") return Promise.resolve();
	return deliver(qc, entry);
}

async function deliver(qc: QueryClient, entry: OutgoingMessage) {
	const { request } = entry;
	const key = request.idempotencyKey;
	const images = request.images ?? [];
	const version = useSessionStore.getState().sessionVersion;
	const active = () =>
		useSessionStore.getState().sessionVersion === version &&
		useChatOutbox.getState().entries.some((item) => item.request.idempotencyKey === key);
	let uploading = images.some(({ task }) => !task.result);
	update(key, { status: uploading ? "uploading" : "sending", error: undefined });
	try {
		let input = request.input;
		if (images.length) {
			const uploaded = await Promise.allSettled(
				images.map(({ task }) =>
					task.upload(() => {
						if (!active()) return;
						const bytes = images.reduce((sum, image) => sum + image.task.file.size, 0);
						const progress = bytes
							? Math.round(
									images.reduce(
										(sum, image) =>
											sum +
											image.task.file.size *
												(image.task.result ? 100 : image.task.progress),
										0,
									) / bytes,
								)
							: 100;
						update(key, { progress });
					}),
				),
			);
			if (!active()) return;
			const failure = uploaded.find((result) => result.status === "rejected");
			if (failure?.status === "rejected") throw failure.reason;
			let content = input.content ?? "";
			const mediaIDs = images.map(({ id, task }) => {
				const result = task.result;
				if (!result) throw new Error("图片尚未上传完成");
				content = content.replaceAll(`![img:${id}]`, `![img:${result.id}]`);
				return result.id;
			});
			input = { ...input, content, media_ids: mediaIDs };
		}
		if (!active()) return;
		uploading = false;
		update(key, { status: "sending", progress: 100 });
		const response = await sendChatMessage(request.id, input, key);
		if (!active()) return;
		await qc.cancelQueries({ queryKey: chatKeys.messages(request.id) });
		if (!active()) return;
		const message = { ...response, client_message_id: key };
		qc.setQueryData<InfiniteData<PagedResponse<ChatMessage>>>(
			chatKeys.messages(request.id),
			(old) => {
				if (
					!old ||
					old.pages.some((page) => page.data.some((item) => item.id === message.id))
				)
					return old;
				return {
					...old,
					pages: old.pages.map((page, index) =>
						index === 0 ? { ...page, data: [message, ...page.data] } : page,
					),
				};
			},
		);
		// 查询观察者接管后再移除，避免缓存通知与 Zustand 更新之间气泡短暂消失。
		update(key, { message, status: "sent" });
		void qc.invalidateQueries({ queryKey: chatKeys.messages(request.id) });
		void qc.invalidateQueries({ queryKey: chatKeys.conversations() });
	} catch (error) {
		if (!active()) return;
		const detail = error instanceof Error ? error.message : "请检查网络后重试";
		update(key, {
			status: "failed",
			error: `${uploading ? "图片上传失败" : "消息发送失败"}：${detail}`,
		});
	}
}
