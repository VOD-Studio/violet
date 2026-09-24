import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BotCommandsResponse, ChatMember, ChatMessage } from "../../model/types";
import { MessageComposer } from "../MessageComposer";
import { MessageEditComposer } from "../MessageEditComposer";

const sendMocks = vi.hoisted(() => ({
	mutateAsync: vi.fn(),
	edit: vi.fn(),
	upload: vi.fn(),
	refetch: vi.fn(),
}));

vi.mock("../../api/queries", () => ({
	useSendChatMessage: () => ({ mutateAsync: sendMocks.mutateAsync, isPending: false }),
	useChatMembers: () => ({ data: activeMembers }),
	useBotCommands: () => ({ data: catalogData, refetch: sendMocks.refetch }),
	useEditChatMessage: () => ({ mutate: sendMocks.edit, isPending: false }),
}));
vi.mock("../../hooks/useChatTyping", () => ({
	useChatTypingBroadcaster: () => ({ notifyTyping: vi.fn(), notifyStopped: vi.fn() }),
}));
vi.mock("@features/emojis/api/queries", () => ({
	useAllEmojis: () => ({ data: [], isLoading: false }),
}));
vi.mock("@features/customemoji/api/queries", () => ({
	useMyCustomEmojis: () => ({ data: [], isLoading: false }),
}));
vi.mock("@features/emojis/api/mutations", () => ({
	useUploadEmoji: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@features/upload/hooks/use-chunked-upload", () => ({
	useChunkedUpload: () => ({ uploadFile: sendMocks.upload }),
}));

const selfID = "00000000-0000-0000-0000-000000000001";
const peerID = "00000000-0000-0000-0000-000000000002";
const sender = { id: peerID, username: "bob", display_name: "Bob", avatar_url: "" };

const members: ChatMember[] = [
	{
		user: { id: selfID, username: "alice", display_name: "Alice", avatar_url: "" },
		role: "member",
		joined_at: "2026-08-25T08:00:00Z",
		is_muted: false,
	},
	{ user: sender, role: "member", joined_at: "2026-08-25T08:00:00Z", is_muted: false },
];
let activeMembers = members;
let catalogData: BotCommandsResponse = { bots: [] };
const bot1 = {
	id: "00000000-0000-0000-0000-000000000010",
	username: "saber",
	display_name: "Saber",
	avatar_url: "",
	is_bot: true,
};
const bot2 = {
	id: "00000000-0000-0000-0000-000000000011",
	username: "helper",
	display_name: "Helper",
	avatar_url: "",
	is_bot: true,
};
const taskCommand = {
	id: "task.list",
	path: ["task", "list"],
	description: "查看任务列表",
	arguments: [],
	scope: "conversation" as const,
};

function textMessage(content?: string): ChatMessage {
	return {
		id: "m_ref",
		conversation_id: "c_1",
		sender,
		type: "text",
		content,
		reactions: [],
		is_deleted: false,
		created_at: "2026-08-25T08:00:00Z",
	};
}

/** 在 contentEditable 里模拟「打完一段文字、光标停在末尾」的输入。 */
function typeInto(box: HTMLElement, text: string) {
	box.textContent = text;
	const range = document.createRange();
	range.setStart(box.firstChild as Text, text.length);
	range.collapse(true);
	const selection = window.getSelection();
	selection?.removeAllRanges();
	selection?.addRange(range);
	fireEvent.input(box);
}

afterEach(() => {
	cleanup();
	sendMocks.mutateAsync.mockReset();
	sendMocks.edit.mockReset();
	sendMocks.upload.mockReset();
	sendMocks.refetch.mockReset();
	activeMembers = members;
	catalogData = { bots: [] };
});

describe("MessageComposer", () => {
	it("私聊斜杠菜单只补全，下一次 Enter 才发送", async () => {
		catalogData = {
			bots: [
				{
					bot_user_id: bot1.id,
					username: bot1.username,
					name: bot1.display_name,
					revision: "v1",
					commands: [taskCommand],
				},
			],
		};
		render(
			<MessageComposer
				conversationID="c_1"
				currentUserID={selfID}
				onCancelReply={() => {}}
				pendingShare={null}
				replyTarget={null}
			/>,
		);
		const box = screen.getByRole("textbox");
		typeInto(box, "/ta");
		expect(screen.getByRole("option", { name: /task list/ })).toBeTruthy();
		fireEvent.keyDown(box, { key: "Enter", isComposing: true });
		fireEvent.keyDown(box, { key: "Enter", shiftKey: true });
		expect(screen.getByRole("option", { name: /task list/ })).toBeTruthy();
		expect(sendMocks.mutateAsync).not.toHaveBeenCalled();
		fireEvent.keyDown(box, { key: "Tab" });
		expect(sendMocks.mutateAsync).not.toHaveBeenCalled();
		expect(box.textContent).toContain("/task list");
		fireEvent.keyDown(box, { key: "Enter" });
		await vi.waitFor(() => expect(sendMocks.mutateAsync).toHaveBeenCalledOnce());
		expect(sendMocks.mutateAsync.mock.calls[0][0].input.content).toBe("/task list");
	});

	it("没有可用 Bot 目录时斜杠仍是普通草稿", async () => {
		render(
			<MessageComposer
				conversationID="c_1"
				conversationKind="room"
				currentUserID={selfID}
				onCancelReply={() => {}}
				pendingShare={null}
				replyTarget={null}
			/>,
		);
		const box = screen.getByRole("textbox");
		typeInto(box, "/task list");
		expect(screen.queryByRole("listbox", { name: "Bot 命令" })).toBeNull();
		fireEvent.keyDown(box, { key: "Enter" });
		await vi.waitFor(() => expect(sendMocks.mutateAsync).toHaveBeenCalledOnce());
		expect(sendMocks.mutateAsync.mock.calls[0][0].input.content).toBe("/task list");
	});

	it("手输命令只自动寻址唯一启用的 Bot", async () => {
		activeMembers = [
			...members,
			{ user: bot1, role: "member", joined_at: "", is_muted: false },
			{ user: bot2, role: "member", joined_at: "", is_muted: false },
		];
		catalogData = {
			bots: [
				{
					bot_user_id: bot1.id,
					username: bot1.username,
					name: "Saber",
					revision: "",
					commands: [],
				},
			],
		};
		render(
			<MessageComposer
				conversationID="c_1"
				conversationKind="room"
				currentUserID={selfID}
				onCancelReply={() => {}}
				pendingShare={null}
				replyTarget={null}
			/>,
		);
		const box = screen.getByRole("textbox");
		typeInto(box, "/task list");
		fireEvent.keyDown(box, { key: "Enter" });
		await vi.waitFor(() => expect(sendMocks.mutateAsync).toHaveBeenCalledOnce());
		expect(sendMocks.mutateAsync.mock.calls[0][0].input.content).toBe(
			`@(saber:${bot1.id}) /task list`,
		);
	});

	it("群聊补全用真实 bot ID 寻址，参数提示不进入草稿", async () => {
		activeMembers = [
			...members,
			{ user: bot1, role: "member", joined_at: "", is_muted: false },
			{ user: bot2, role: "member", joined_at: "", is_muted: false },
		];
		catalogData = {
			bots: [
				{
					bot_user_id: bot1.id,
					username: bot1.username,
					name: bot1.display_name,
					revision: "v1",
					commands: [
						{
							...taskCommand,
							id: "task.status",
							path: ["task", "status"],
							arguments: [{ name: "id", type: "integer", required: true }],
						},
					],
				},
				{
					bot_user_id: bot2.id,
					username: bot2.username,
					name: bot2.display_name,
					revision: "v1",
					commands: [taskCommand],
				},
			],
		};
		render(
			<MessageComposer
				conversationID="c_1"
				conversationKind="room"
				currentUserID={selfID}
				onCancelReply={() => {}}
				pendingShare={null}
				replyTarget={null}
			/>,
		);
		const box = screen.getByRole("textbox");
		typeInto(box, "/task");
		expect(screen.getByRole("option", { name: /Saber \/task status <id>/ })).toBeTruthy();
		fireEvent.keyDown(box, { key: "ArrowDown" });
		fireEvent.keyDown(box, { key: "Enter" });
		expect(sendMocks.mutateAsync).not.toHaveBeenCalled();
		expect(box.querySelector("[data-mention]")?.getAttribute("data-mention")).toBe(bot2.id);
		fireEvent.keyDown(box, { key: "Enter" });
		await vi.waitFor(() => expect(sendMocks.mutateAsync).toHaveBeenCalledOnce());
		expect(sendMocks.mutateAsync.mock.calls[0][0].input.content).toBe(
			`@(helper:${bot2.id}) /task list`,
		);
	});

	it("多 bot 手输命令先选择目标；Esc 只关闭命令菜单", async () => {
		activeMembers = [
			...members,
			{ user: bot1, role: "member", joined_at: "", is_muted: false },
			{ user: bot2, role: "member", joined_at: "", is_muted: false },
		];
		catalogData = {
			bots: [
				{
					bot_user_id: bot1.id,
					username: bot1.username,
					name: bot1.display_name,
					revision: "v1",
					commands: [taskCommand],
				},
				{
					bot_user_id: bot2.id,
					username: bot2.username,
					name: bot2.display_name,
					revision: "",
					commands: [],
				},
			],
		};
		const cancelReply = vi.fn();
		render(
			<MessageComposer
				conversationID="c_1"
				conversationKind="room"
				currentUserID={selfID}
				onCancelReply={cancelReply}
				pendingShare={null}
				replyTarget={textMessage("原消息")}
			/>,
		);
		const box = screen.getByRole("textbox");
		typeInto(box, "/");
		fireEvent.keyDown(box, { key: "Escape" });
		expect(screen.queryByRole("option")).toBeNull();
		expect(cancelReply).not.toHaveBeenCalled();
		typeInto(box, "/task list 9");
		fireEvent.keyDown(box, { key: "Enter" });
		expect(sendMocks.mutateAsync).not.toHaveBeenCalled();
		expect(screen.getByRole("listbox", { name: "选择命令目标" })).toBeTruthy();
		fireEvent.keyDown(box, { key: "ArrowDown" });
		fireEvent.keyDown(box, { key: "Enter" });
		expect(box.querySelector("[data-mention]")?.getAttribute("data-mention")).toBe(bot2.id);
		fireEvent.keyDown(box, { key: "Enter" });
		await vi.waitFor(() => expect(sendMocks.mutateAsync).toHaveBeenCalledOnce());
		expect(sendMocks.mutateAsync.mock.calls[0][0].input.content).toBe(
			`@(helper:${bot2.id}) /task list 9`,
		);
	});
	it("剥离表情占位符，不泄漏裸 token 文本", () => {
		render(
			<MessageComposer
				conversationID="c_1"
				currentUserID={selfID}
				onCancelReply={() => {}}
				pendingShare={null}
				replyTarget={textMessage("你好[1:00000000-0000-0000-0000-000000000001]世界")}
			/>,
		);

		expect(screen.getByText("你好世界")).toBeTruthy();
		expect(screen.queryByText(/\[1:/)).toBeNull();
	});

	it("回复预览把提及占位符还原成 @username，不泄漏裸 token", () => {
		render(
			<MessageComposer
				conversationID="c_1"
				currentUserID={selfID}
				onCancelReply={() => {}}
				pendingShare={null}
				replyTarget={textMessage(`@(bob:${peerID}) 你好`)}
			/>,
		);

		expect(screen.getByText("@bob 你好")).toBeTruthy();
		expect(screen.queryByText(/@\(bob:/)).toBeNull();
	});

	it("挂载后聚焦消息输入框", () => {
		render(
			<MessageComposer
				conversationID="c_1"
				currentUserID={selfID}
				onCancelReply={() => {}}
				pendingShare={null}
				replyTarget={null}
			/>,
		);

		expect(screen.getByRole("textbox")).toBe(document.activeElement);
	});

	it("选择回复目标后重新聚焦消息输入框", () => {
		const { rerender } = render(
			<>
				<button type="button">回复</button>
				<MessageComposer
					conversationID="c_1"
					currentUserID={selfID}
					onCancelReply={() => {}}
					pendingShare={null}
					replyTarget={null}
				/>
			</>,
		);
		screen.getByRole("button", { name: "回复" }).focus();

		rerender(
			<>
				<button type="button">回复</button>
				<MessageComposer
					conversationID="c_1"
					currentUserID={selfID}
					onCancelReply={() => {}}
					pendingShare={null}
					replyTarget={textMessage("原消息")}
				/>
			</>,
		);

		expect(screen.getByRole("textbox")).toBe(document.activeElement);
	});

	it("输入 @ 弹出会话成员候选，自己不在候选里", () => {
		render(
			<MessageComposer
				conversationID="c_1"
				currentUserID={selfID}
				onCancelReply={() => {}}
				pendingShare={null}
				replyTarget={null}
			/>,
		);

		typeInto(screen.getByRole("textbox"), "@");

		expect(screen.getByRole("option", { name: /Bob/ })).toBeTruthy();
		expect(screen.queryByRole("option", { name: /Alice/ })).toBeNull();
	});

	it("选中候选后发出的正文是提及占位符，而非用户名字面量", async () => {
		render(
			<MessageComposer
				conversationID="c_1"
				currentUserID={selfID}
				onCancelReply={() => {}}
				pendingShare={null}
				replyTarget={null}
			/>,
		);
		const box = screen.getByRole("textbox");
		typeInto(box, "@bo");

		fireEvent.click(screen.getByRole("option", { name: /Bob/ }));

		expect(box.querySelector("[data-mention]")?.textContent).toBe("@Bob");
		fireEvent.click(screen.getByRole("button", { name: "发送消息" }));
		await vi.waitFor(() => expect(sendMocks.mutateAsync).toHaveBeenCalled());
		expect(sendMocks.mutateAsync.mock.calls[0][0].input.content).toBe(`@(bob:${peerID})`);
	});

	it("候选浮层开着时按 Esc 只关浮层，不冒泡取消回复", () => {
		const onCancelReply = vi.fn();
		render(
			<MessageComposer
				conversationID="c_1"
				currentUserID={selfID}
				onCancelReply={onCancelReply}
				pendingShare={null}
				replyTarget={textMessage("原消息")}
			/>,
		);
		const box = screen.getByRole("textbox");
		typeInto(box, "@bo");

		fireEvent.keyDown(box, { key: "Escape" });

		expect(screen.queryByRole("option")).toBeNull();
		expect(onCancelReply).not.toHaveBeenCalled();
	});
});

describe("MessageComposer 全体提及", () => {
	it.each([
		"@",
		"@所有",
		"@all",
	])("房间输入 %s 可选择所有人，并发送独立的全体占位符", async (query) => {
		render(
			<MessageComposer
				conversationID="c_1"
				conversationKind="room"
				currentUserID={selfID}
				onCancelReply={() => {}}
				pendingShare={null}
				replyTarget={null}
			/>,
		);
		const box = screen.getByRole("textbox");
		typeInto(box, query);
		const all = screen.getByRole("option", { name: /所有人/ });
		expect(screen.getAllByRole("option")[0]).toBe(all);
		fireEvent.keyDown(box, { key: "Enter" });
		expect(sendMocks.mutateAsync).not.toHaveBeenCalled();
		expect(box.querySelector('[data-mention="all"]')?.textContent).toBe("@所有人");
		fireEvent.click(screen.getByRole("button", { name: "发送消息" }));
		await vi.waitFor(() => expect(sendMocks.mutateAsync).toHaveBeenCalled());
		expect(sendMocks.mutateAsync.mock.calls[0][0].input.content).toBe("@(all:all)");
	});

	it("私聊不提供全体提及候选", () => {
		render(
			<MessageComposer
				conversationID="c_1"
				conversationKind="direct"
				currentUserID={selfID}
				onCancelReply={() => {}}
				pendingShare={null}
				replyTarget={null}
			/>,
		);
		typeInto(screen.getByRole("textbox"), "@");
		expect(screen.queryByRole("option", { name: /所有人/ })).toBeNull();
		expect(screen.getByRole("option", { name: /Bob/ })).toBeTruthy();
	});
});

describe("MessageEditComposer 全体提及", () => {
	it("房间编辑可选所有人，预填的全体提及仍保留在提交正文中", () => {
		render(
			<MessageEditComposer
				message={textMessage("@(all:all) 原文")}
				conversationKind="room"
				currentUserID={selfID}
				onClose={() => {}}
			/>,
		);
		const box = screen.getByRole("textbox");
		expect(box.querySelector('[data-mention="all"]')?.textContent).toBe("@所有人");
		const tail = document.createTextNode(" @");
		box.append(tail);
		const range = document.createRange();
		range.setStart(tail, tail.length);
		range.collapse(true);
		window.getSelection()?.removeAllRanges();
		window.getSelection()?.addRange(range);
		fireEvent.input(box);
		fireEvent.click(screen.getByRole("option", { name: /所有人/ }));
		fireEvent.click(screen.getByRole("button", { name: "保存编辑" }));
		expect(sendMocks.edit.mock.calls[0][0].input.content).toBe("@(all:all) 原文 @(all:all)");
		expect(sendMocks.mutateAsync).not.toHaveBeenCalled();
	});
});

describe("乐观提交", () => {
	it("网络未完成时立即清空输入框并允许连续提交", () => {
		sendMocks.mutateAsync.mockReturnValue(new Promise(() => {}));
		render(
			<MessageComposer
				conversationID="c_1"
				currentUserID={selfID}
				onCancelReply={() => {}}
				pendingShare={null}
				replyTarget={null}
			/>,
		);
		const box = screen.getByRole("textbox");
		typeInto(box, "第一条");
		fireEvent.keyDown(box, { key: "Enter" });
		expect(box.textContent).toBe("");
		typeInto(box, "第二条");
		const button = screen.getByRole("button", { name: "发送消息" });
		expect(button.querySelector(".animate-spin")).toBeNull();
		fireEvent.click(button);
		expect(sendMocks.mutateAsync).toHaveBeenCalledTimes(2);
		expect(sendMocks.mutateAsync.mock.calls.map(([request]) => request.input.content)).toEqual([
			"第一条",
			"第二条",
		]);
	});

	it("提交时快照引用内容并立即解除回复", () => {
		const cancel = vi.fn();
		const target = textMessage("被引用的内容");
		render(
			<MessageComposer
				conversationID="c_1"
				currentUserID={selfID}
				onCancelReply={cancel}
				pendingShare={null}
				replyTarget={target}
			/>,
		);
		typeInto(screen.getByRole("textbox"), "回复正文");
		fireEvent.click(screen.getByRole("button", { name: "发送消息" }));
		expect(sendMocks.mutateAsync.mock.calls[0][0]).toMatchObject({
			input: { reply_to_id: target.id },
			draft: { reply_to: { id: target.id, content: target.content, sender } },
		});
		expect(cancel).toHaveBeenCalledOnce();
	});

	it("推文分享立即提交卡片快照与配文", () => {
		render(
			<MessageComposer
				conversationID="c_1"
				currentUserID={selfID}
				onCancelReply={() => {}}
				pendingShare={{
					conversationId: "c_1",
					tweet: {
						id: "tweet",
						authorUsername: "bob",
						content: "推文原文",
						imageUrl: "/tweet.png",
					},
				}}
				replyTarget={null}
			/>,
		);
		typeInto(screen.getByRole("textbox"), "分享配文");
		fireEvent.click(screen.getByRole("button", { name: "发送消息" }));
		expect(screen.getByRole("textbox").textContent).toBe("");
		expect(sendMocks.mutateAsync.mock.calls[0][0]).toMatchObject({
			input: { type: "tweet_share", shared_tweet_id: "tweet", content: "分享配文" },
			draft: {
				shared_tweet: {
					id: "tweet",
					content: "推文原文",
					images: ["/tweet.png"],
					author: { username: "bob" },
				},
			},
		});
	});
});

it("图片上传未完成也可发送并移交原始文件", async () => {
	sendMocks.upload.mockReturnValue(new Promise(() => {}));
	const { container } = render(
		<MessageComposer
			conversationID="c_1"
			currentUserID={selfID}
			onCancelReply={() => {}}
			pendingShare={null}
			replyTarget={null}
		/>,
	);
	const file = new File(["image"], "photo.png", { type: "image/png" });
	fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
		target: { files: [file] },
	});
	const send = screen.getByRole("button", { name: "发送消息" }) as HTMLButtonElement;
	await vi.waitFor(() => expect(send.disabled).toBe(false));
	fireEvent.click(send);
	expect(sendMocks.mutateAsync).toHaveBeenCalledOnce();
	const request = sendMocks.mutateAsync.mock.calls[0][0];
	expect(request.input.type).toBe("image");
	expect(request.input.content).toBe(`![img:${request.images[0].id}]`);
	expect(request.images[0].task.file).toBe(file);
	expect(screen.getByRole("textbox").textContent).toBe("");
});
