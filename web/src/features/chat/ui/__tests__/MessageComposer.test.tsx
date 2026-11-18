import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BotCommandsResponse, ChatMember, ChatMessage, ChatUser } from "../../model/types";
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
	useChatMessages: () => ({ data: messagePages ? { pages: messagePages } : undefined }),
	useBotCommands: () => ({ data: catalogData, refetch: sendMocks.refetch, ...commandQueryState }),
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
		online: false,
		can_speak: true,
	},
	{
		user: sender,
		role: "member",
		joined_at: "2026-08-25T08:00:00Z",
		is_muted: false,
		online: false,
		can_speak: true,
	},
];
const carol = {
	id: "00000000-0000-0000-0000-000000000003",
	username: "carol",
	display_name: "Carol",
	avatar_url: "",
};
const linjian = {
	id: "00000000-0000-0000-0000-000000000004",
	username: "linjian",
	display_name: "林间",
	avatar_url: "",
};
const roomBot = {
	id: "00000000-0000-0000-0000-000000000005",
	username: "saber",
	display_name: "Saber",
	avatar_url: "",
	is_bot: true,
};
const extraMembers: ChatMember[] = [
	{
		user: carol,
		role: "owner",
		joined_at: "2026-08-26T08:00:00Z",
		is_muted: false,
		online: false,
		can_speak: true,
	},
	{
		user: linjian,
		role: "member",
		joined_at: "2026-08-27T08:00:00Z",
		is_muted: false,
		online: false,
		can_speak: true,
	},
	{
		user: roomBot,
		role: "member",
		joined_at: "2026-08-28T08:00:00Z",
		is_muted: false,
		online: false,
		can_speak: true,
	},
];
let activeMembers = members;
let catalogData: BotCommandsResponse = { bots: [] };
const commandQueryState = { isPending: false, isError: false };
/** 会话面板已缓存的消息页，按分页首屏最新排列；缺省表示还没加载到消息。 */
let messagePages: { data: ChatMessage[] }[] | undefined;
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

function messageFrom(sender: ChatUser, id: string): ChatMessage {
	return { ...textMessage("hi"), id, sender };
}

/** 在 contentEditable 里模拟「打完一段文字、光标停在末尾」的输入。 */
function typeInto(box: HTMLElement, text: string) {
	box.focus();
	box.textContent = text;
	const range = document.createRange();
	range.setStart(box.firstChild as Text, text.length);
	range.collapse(true);
	const selection = window.getSelection();
	selection?.removeAllRanges();
	selection?.addRange(range);
	fireEvent.input(box);
}

async function selectInputAction(name: string) {
	fireEvent.keyDown(screen.getByRole("button", { name: "添加内容" }), { key: "ArrowDown" });
	const item = screen.getByRole("menuitem", { name });
	act(() => item.focus());
	fireEvent.click(item);
	await vi.waitFor(() => expect(document.activeElement).toBe(screen.getByRole("textbox")));
}

afterEach(() => {
	cleanup();
	sendMocks.mutateAsync.mockReset();
	sendMocks.edit.mockReset();
	sendMocks.upload.mockReset();
	sendMocks.refetch.mockReset();
	activeMembers = members;
	catalogData = { bots: [] };
	commandQueryState.isPending = false;
	commandQueryState.isError = false;
	messagePages = undefined;
});

describe("MessageComposer", () => {
	it("私聊斜杠菜单只补全，下一次 Enter 才发送", async () => {
		catalogData = {
			bots: [
				{
					bot_user_id: bot1.id,
					username: bot1.username,
					name: bot1.display_name,
					description: "",
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
			{
				user: bot1,
				role: "member",
				joined_at: "",
				is_muted: false,
				online: false,
				can_speak: true,
			},
			{
				user: bot2,
				role: "member",
				joined_at: "",
				is_muted: false,
				online: false,
				can_speak: true,
			},
		];
		catalogData = {
			bots: [
				{
					bot_user_id: bot1.id,
					username: bot1.username,
					name: "Saber",
					description: "",
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
			{
				user: bot1,
				role: "member",
				joined_at: "",
				is_muted: false,
				online: false,
				can_speak: true,
			},
			{
				user: bot2,
				role: "member",
				joined_at: "",
				is_muted: false,
				online: false,
				can_speak: true,
			},
		];
		catalogData = {
			bots: [
				{
					bot_user_id: bot1.id,
					username: bot1.username,
					name: bot1.display_name,
					description: "",
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
					description: "",
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
			{
				user: bot1,
				role: "member",
				joined_at: "",
				is_muted: false,
				online: false,
				can_speak: true,
			},
			{
				user: bot2,
				role: "member",
				joined_at: "",
				is_muted: false,
				online: false,
				can_speak: true,
			},
		];
		catalogData = {
			bots: [
				{
					bot_user_id: bot1.id,
					username: bot1.username,
					name: bot1.display_name,
					description: "",
					revision: "v1",
					commands: [taskCommand],
				},
				{
					bot_user_id: bot2.id,
					username: bot2.username,
					name: bot2.display_name,
					description: "",
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
				replyTarget={textMessage(`@(bob:${peerID}) 你好`)}
			/>,
		);

		expect(screen.getByText("@bob 你好")).toBeTruthy();
		expect(screen.queryByText(/@\(bob:/)).toBeNull();
	});

	it("选择回复目标后重新聚焦消息输入框", () => {
		const { rerender } = render(
			<>
				<button type="button">回复</button>
				<MessageComposer
					conversationID="c_1"
					currentUserID={selfID}
					onCancelReply={() => {}}
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

describe("MessageComposer 输入操作", () => {
	it("从添加菜单选择图片会打开文件选择器", () => {
		const { container } = render(
			<MessageComposer
				conversationID="c_1"
				conversationKind="room"
				conversationTitle="大厅"
				currentUserID={selfID}
				onCancelReply={() => {}}
				replyTarget={textMessage("被引用的内容")}
			/>,
		);
		const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
		const openFilePicker = vi.spyOn(fileInput, "click");
		fireEvent.keyDown(screen.getByRole("button", { name: "添加内容" }), { key: "ArrowDown" });
		fireEvent.click(screen.getByRole("menuitem", { name: "添加图片" }));
		expect(openFilePicker).toHaveBeenCalledOnce();
	});

	it("角色按钮不覆盖草稿，选择真实命令后将草稿保留为参数", async () => {
		catalogData = {
			bots: [
				{
					bot_user_id: bot1.id,
					username: bot1.username,
					name: bot1.display_name,
					description: "",
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
				replyTarget={null}
			/>,
		);
		const editor = screen.getByRole("textbox");
		typeInto(editor, "下雨天");
		await selectInputAction("召唤角色");
		expect(editor.textContent).toBe("下雨天");
		expect(sendMocks.refetch).toHaveBeenCalled();
		fireEvent.click(screen.getByRole("option", { name: /task list/ }));
		expect(editor.textContent).toBe("/task list\u00a0下雨天");
		expect(sendMocks.mutateAsync).not.toHaveBeenCalled();
		fireEvent.keyDown(editor, { key: "Enter" });
		expect(sendMocks.mutateAsync.mock.calls[0][0].input.content).toBe("/task list 下雨天");
	});

	it("无命令也显示真实空态，Escape 只关闭菜单且保留回复和草稿", async () => {
		const cancelReply = vi.fn();
		render(
			<MessageComposer
				conversationID="c_1"
				currentUserID={selfID}
				onCancelReply={cancelReply}
				replyTarget={textMessage("原消息")}
			/>,
		);
		const editor = screen.getByRole("textbox");
		typeInto(editor, "我的草稿");
		await selectInputAction("召唤角色");
		expect(screen.getByRole("status").textContent).toBe("本会话暂无可用的角色命令");
		expect(screen.queryByRole("option")).toBeNull();
		expect(editor.getAttribute("aria-activedescendant")).toBeNull();
		fireEvent.keyDown(editor, { key: "Escape" });
		expect(screen.queryByRole("status")).toBeNull();
		expect(editor.textContent).toBe("我的草稿");
		expect(cancelReply).not.toHaveBeenCalled();
	});

	it("命令目录区分加载和失败，失败入口会重新查询", async () => {
		commandQueryState.isPending = true;
		const props = {
			conversationID: "c_1",
			currentUserID: selfID,
			onCancelReply: vi.fn(),
			replyTarget: null,
		};
		const { rerender } = render(<MessageComposer {...props} />);
		await selectInputAction("召唤角色");
		expect(screen.getByRole("status").textContent).toBe("正在加载角色命令…");
		commandQueryState.isPending = false;
		commandQueryState.isError = true;
		rerender(<MessageComposer {...props} />);
		expect(screen.getByRole("alert").textContent).toContain("角色命令加载失败");
		const requests = sendMocks.refetch.mock.calls.length;
		fireEvent.click(screen.getByRole("button", { name: "重新加载" }));
		expect(sendMocks.refetch).toHaveBeenCalledTimes(requests + 1);
	});

	it("提及按钮打开真实候选，选择后提交成员占位符并保留原草稿", async () => {
		render(
			<MessageComposer
				conversationID="c_1"
				currentUserID={selfID}
				onCancelReply={() => {}}
				replyTarget={null}
			/>,
		);
		const editor = screen.getByRole("textbox");
		typeInto(editor, "请看");
		await selectInputAction("提及成员");
		expect(screen.getByRole("option", { name: /Bob/ })).toBeTruthy();
		expect(screen.queryByRole("option", { name: /Alice/ })).toBeNull();
		fireEvent.click(screen.getByRole("option", { name: /Bob/ }));
		fireEvent.click(screen.getByRole("button", { name: "发送消息" }));
		expect(sendMocks.mutateAsync.mock.calls[0][0].input.content).toBe(`请看 @(bob:${peerID})`);
	});
});

describe("MessageComposer 全体提及", () => {
	it.each([
		"@",
		"@全体",
		"@all",
	])("房间输入 %s 可选择全体成员，并发送独立的全体占位符", async (query) => {
		render(
			<MessageComposer
				conversationID="c_1"
				conversationKind="room"
				currentUserID={selfID}
				onCancelReply={() => {}}
				replyTarget={null}
			/>,
		);
		const box = screen.getByRole("textbox");
		typeInto(box, query);
		const all = screen.getByRole("option", { name: /全体成员/ });
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
				replyTarget={null}
			/>,
		);
		typeInto(screen.getByRole("textbox"), "@");
		expect(screen.queryByRole("option", { name: /全体成员/ })).toBeNull();
		expect(screen.getByRole("option", { name: /Bob/ })).toBeTruthy();
	});
});

describe("MessageComposer 提及候选", () => {
	beforeEach(() => {
		activeMembers = [...members, ...extraMembers];
		// 页内按时间升序：Bob 更早，Carol 刚说话
		messagePages = [{ data: [messageFrom(sender, "m1"), messageFrom(carol, "m2")] }];
	});

	it("全体成员置顶带人数，最近发言者排前，角色与机器人带标签", () => {
		render(
			<MessageComposer
				conversationID="c_1"
				conversationKind="room"
				currentUserID={selfID}
				onCancelReply={() => {}}
				replyTarget={null}
			/>,
		);
		typeInto(screen.getByRole("textbox"), "@");

		const options = screen.getAllByRole("option");
		expect(options).toHaveLength(5);
		expect(options[0].textContent).toContain("全体成员");
		expect(options[0].textContent).toContain("5 人");
		expect(options[1].textContent).toContain("Carol");
		expect(options[1].textContent).toContain("管理员");
		expect(options[2].textContent).toContain("Bob");
		expect(options[3].textContent).toContain("林间");
		expect(options[4].textContent).toContain("机器人");
	});

	it("拼音首字母也能筛到人", () => {
		render(
			<MessageComposer
				conversationID="c_1"
				conversationKind="room"
				currentUserID={selfID}
				onCancelReply={() => {}}
				replyTarget={null}
			/>,
		);
		typeInto(screen.getByRole("textbox"), "@lj");

		expect(screen.getAllByRole("option")).toHaveLength(1);
		expect(screen.getByRole("option", { name: /林间/ })).toBeTruthy();
	});

	it("输入框暴露 aria-autocomplete 与展开态，Esc 只收浮层", () => {
		render(
			<MessageComposer
				conversationID="c_1"
				conversationKind="room"
				currentUserID={selfID}
				onCancelReply={() => {}}
				replyTarget={null}
			/>,
		);
		const box = screen.getByRole("textbox");
		typeInto(box, "@");
		const listbox = screen.getByRole("listbox");
		expect(box.getAttribute("aria-autocomplete")).toBe("list");
		expect(box.getAttribute("aria-controls")).toBe(listbox.id);
		expect(box.getAttribute("aria-activedescendant")).toBe(screen.getAllByRole("option")[0].id);

		fireEvent.keyDown(box, { key: "Escape" });

		expect(screen.queryByRole("listbox")).toBeNull();
		expect(box.getAttribute("aria-expanded")).toBe("false");
	});

	it.each(["Enter", "Tab"])("方向键选择成员后用 %s 插入且不发送", (key) => {
		render(
			<MessageComposer
				conversationID="c_1"
				conversationKind="room"
				currentUserID={selfID}
				onCancelReply={() => {}}
				replyTarget={null}
			/>,
		);
		const box = screen.getByRole("textbox");
		typeInto(box, "请看 @");
		const options = screen.getAllByRole("option");
		fireEvent.keyDown(box, { key: "ArrowDown" });
		expect(box.getAttribute("aria-activedescendant")).toBe(options[1].id);
		fireEvent.keyDown(box, { key: "ArrowUp" });
		expect(box.getAttribute("aria-activedescendant")).toBe(options[0].id);
		fireEvent.keyDown(box, { key: "ArrowDown" });
		fireEvent.keyDown(box, { key });
		expect(box.textContent).toBe("请看 @Carol\u00a0");
		expect(screen.queryByRole("listbox")).toBeNull();
		expect(sendMocks.mutateAsync).not.toHaveBeenCalled();
	});

	it("Esc 保留草稿，邮箱和超过二十字的查询不触发", () => {
		render(
			<MessageComposer
				conversationID="c_1"
				conversationKind="room"
				currentUserID={selfID}
				onCancelReply={() => {}}
				replyTarget={null}
			/>,
		);
		const box = screen.getByRole("textbox");
		typeInto(box, "请看 @lj");
		fireEvent.keyDown(box, { key: "Escape" });
		expect(box.textContent).toBe("请看 @lj");
		typeInto(box, "person@example.com");
		expect(screen.queryByRole("listbox")).toBeNull();
		typeInto(box, `@${"字".repeat(21)}`);
		expect(screen.queryByRole("listbox")).toBeNull();
	});
});

describe("MessageEditComposer 全体提及", () => {
	it("房间编辑可选全体成员，预填的全体提及仍保留在提交正文中", () => {
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
		fireEvent.click(screen.getByRole("option", { name: /全体成员/ }));
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
});

it("图片上传未完成也可发送并移交原始文件", async () => {
	sendMocks.upload.mockReturnValue(new Promise(() => {}));
	const { container } = render(
		<MessageComposer
			conversationID="c_1"
			currentUserID={selfID}
			onCancelReply={() => {}}
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

it("角色命令草稿中的提及按钮优先打开成员候选", async () => {
	render(
		<MessageComposer
			conversationID="c_1"
			currentUserID={selfID}
			onCancelReply={() => {}}
			replyTarget={null}
		/>,
	);
	const editor = screen.getByRole("textbox");
	typeInto(editor, "/task");
	expect(screen.getByRole("status").textContent).toBe("没有匹配的角色命令");
	await selectInputAction("提及成员");
	expect(screen.getByRole("option", { name: /Bob/ })).toBeTruthy();
	expect(screen.queryByText("没有匹配的角色命令")).toBeNull();
});

it("提及与命令候选都在输入壳外呈现，并保留正文、焦点和原光标", () => {
	catalogData = {
		bots: [
			{
				bot_user_id: bot1.id,
				username: bot1.username,
				name: bot1.display_name,
				description: "",
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
			replyTarget={null}
		/>,
	);
	const editor = screen.getByRole("textbox");
	const shell = editor.closest('[data-slot="rich-text-input"]');
	expect(shell).not.toBeNull();
	for (const text of ["/ta", "@bo"]) {
		typeInto(editor, text);
		const list = screen.getByRole("listbox");
		expect(shell?.contains(list)).toBe(false);
		expect(editor.textContent).toBe(text);
		expect(document.activeElement).toBe(editor);
		expect(window.getSelection()?.anchorNode).toBe(editor.firstChild);
		expect(window.getSelection()?.anchorOffset).toBe(text.length);
		if (text.startsWith("/")) {
			expect(screen.getByRole("option").getAttribute("aria-current")).toBe("true");
			expect(screen.getByText("Saber · 查看任务列表")).toBeTruthy();
		}
		fireEvent.keyDown(editor, { key: "Escape" });
	}
	expect(sendMocks.mutateAsync).not.toHaveBeenCalled();
});
