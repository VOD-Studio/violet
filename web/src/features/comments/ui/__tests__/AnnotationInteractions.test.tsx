import type { Comment } from "@entities/comment/model/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeBlockId } from "../../lib/block-id";
import type { BlockCount } from "../../model/types";
import { AnnotationLayer } from "../AnnotationLayer";
// 本组验证交互状态，在用例计时前加载真实模块；冷下载由浏览器契约覆盖。
import "../AnnotationPopover";

const requests = vi.hoisted(() => ({
	apiGet: vi.fn(),
	apiGetPaged: vi.fn(),
	apiPost: vi.fn(),
	apiPatch: vi.fn(),
	apiDelete: vi.fn(),
}));
vi.mock("@shared/api/request", () => requests);

const paragraph = "同一段文字可以承载多位读者的独立讨论。";
/** 两位读者批注同一处「同一段文」，第三位批注另一处「承载」。 */
const QUOTE_A = "同一段文";
const QUOTE_B = "承载";
let blockId: string;
let anchorTop = 120;
let comments: Comment[];
const clients: QueryClient[] = [];

function Harness({ summary }: { summary: BlockCount[] }) {
	const contentRef = useRef<HTMLDivElement>(null);
	return (
		<>
			<div ref={contentRef} role="region" aria-label="文章正文">
				<p>{paragraph}</p>
			</div>
			<AnnotationLayer contentRef={contentRef} summary={summary} postId="post-1" isLoggedIn />
			<button type="button">真正外部按钮</button>
		</>
	);
}

function comment(id: string, name: string, body: string, start: number, end: number): Comment {
	return {
		id,
		post_id: "post-1",
		depth: 0,
		author_name: name,
		avatar_url: "",
		body,
		pictures: [],
		is_author: false,
		status: "approved",
		created_at: "2026-10-17T00:00:00Z",
		anchor: {
			block_id: blockId,
			block_text_hash: blockId,
			start_offset: start,
			end_offset: end,
			selected_text: paragraph.slice(start, end),
		},
	};
}

function annotationReply(id: string, body: string, overrides: Partial<Comment> = {}): Comment {
	return {
		...comment(id, "回复者", body, 0, 4),
		depth: 1,
		parent_id: "c1",
		thread_root_id: "c1",
		...overrides,
	};
}

function mount() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	clients.push(client);
	render(
		<QueryClientProvider client={client}>
			<Harness
				summary={[
					{
						block_id: blockId,
						count: 3,
						authors: ["读者甲", "读者乙", "读者丙"].map((name) => ({
							name,
							avatar_url: "",
							is_ai: false,
						})),
						ranges: [
							{ start: 0, end: 4, is_ai: false, author_name: "读者甲" },
							{ start: 0, end: 4, is_ai: false, author_name: "读者乙" },
							{ start: 7, end: 9, is_ai: false, author_name: "读者丙" },
						],
					},
				]}
			/>
		</QueryClientProvider>,
	);
}

/** 点页边头像组里第一位评论者，打开整段批注卡。 */
async function openBlock() {
	mount();
	fireEvent.click(await screen.findByRole("button", { name: "读者甲 的批注" }));
	await act(() => vi.dynamicImportSettled());
	return screen.findByRole("dialog", { name: "段落批注" });
}

async function openMark(name = `2 条批注：${QUOTE_A}`) {
	mount();
	const mark = await screen.findByRole("button", { name });
	fireEvent.click(mark);
	await act(() => vi.dynamicImportSettled());
	return { mark, dialog: await screen.findByRole("dialog", { name: "批注" }) };
}

function write(editor: HTMLElement, text: string) {
	editor.textContent = text;
	fireEvent.input(editor);
}

async function sendReply(dialog: HTMLElement, body: string) {
	fireEvent.click(await within(dialog).findByRole("button", { name: "回复 读者甲" }));
	const editor = within(dialog).getByRole("textbox", { name: "评论内容" });
	write(editor, body);
	const form = editor.closest("form");
	if (!form) throw new Error("回复输入必须属于提交表单");
	fireEvent.click(within(form).getByRole("button", { name: /发送|提交|回复/ }));
	await waitFor(() =>
		expect(within(dialog).queryByRole("textbox", { name: "评论内容" })).toBeNull(),
	);
}

beforeEach(async () => {
	vi.clearAllMocks();
	anchorTop = 120;
	blockId = (await computeBlockId(paragraph)) ?? "";
	comments = [
		comment("c1", "读者甲", "读者甲的第一条批注", 0, 4),
		comment("c2", "读者乙", "读者乙的看法", 0, 4),
		comment("c3", "读者丙", "读者丙谈承载", 7, 9),
	];
	comments[0] = {
		...comments[0],
		replies: [{ ...comment("r1", "读者丁", "读者丁的回复", 0, 4), depth: 1, parent_id: "c1" }],
	};
	requests.apiGetPaged.mockImplementation(async () => ({
		data: comments,
		pagination: { page: 1, limit: 20, total: comments.length, total_pages: 1 },
	}));
	requests.apiGet.mockImplementation(async (path: string) =>
		path === "/emojis"
			? [
					{
						id: 1,
						name: "文字表情",
						source: "system",
						sort_order: 0,
						is_enabled: true,
						type: 1,
						emojis: [{ id: 1, name: "微笑", url: "", text_content: "笑" }],
					},
				]
			: [],
	);
	requests.apiPost.mockResolvedValue({ ...comments[0], id: "created", body: "新的批注" });
	vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
		() => new DOMRect(400, anchorTop, 144, 40),
	);
});

afterEach(() => {
	for (const client of clients) client.clear();
	clients.length = 0;
	vi.restoreAllMocks();
});

describe("划线文字与页边条数的读屏契约", () => {
	it("划线是名为「N 条批注：原文」的按钮，同区间的批注合并计数，正文文字不变", async () => {
		mount();
		const first = await screen.findByRole("button", { name: `2 条批注：${QUOTE_A}` });
		const second = screen.getByRole("button", { name: `1 条批注：${QUOTE_B}` });
		expect(first.tagName).toBe("MARK");
		expect(first.tabIndex).toBe(0);
		expect(second.tagName).toBe("MARK");
		expect(screen.getByLabelText("文章正文").textContent).toBe(paragraph);
	});

	it("页边是评论者头像组，读成「本段 N 条批注」，头像按原始署名各自可选", async () => {
		mount();
		const group = await screen.findByRole("group", { name: "本段 3 条批注" });
		for (const name of ["读者甲", "读者乙", "读者丙"]) {
			expect(within(group).getByRole("button", { name: `${name} 的批注` })).toBeTruthy();
		}
	});
});

describe("批注卡", () => {
	it("点划线打开该区间的批注卡：原文引用，批注与其回复依次排列，不含别处的批注", async () => {
		const { mark, dialog } = await openMark();
		expect(within(dialog).getByText(QUOTE_A)).toBeTruthy();
		await within(dialog).findByText("读者甲的第一条批注");
		const bodies = within(dialog)
			.getAllByText(/读者.的/)
			.map((node) => node.textContent);
		expect(bodies).toEqual(["读者甲的第一条批注", "读者丁的回复", "读者乙的看法"]);
		expect(within(dialog).queryByText("读者丙谈承载")).toBeNull();
		expect(mark.getAttribute("aria-expanded")).toBe("true");
	});

	it("键盘 Enter 打开，Escape 关闭并把焦点还给划线", async () => {
		mount();
		const mark = await screen.findByRole("button", { name: `2 条批注：${QUOTE_A}` });
		mark.focus();
		fireEvent.keyDown(mark, { key: "Enter" });
		await act(() => vi.dynamicImportSettled());
		const dialog = await screen.findByRole("dialog", { name: "批注" });
		fireEvent.keyDown(dialog, { key: "Escape" });
		await waitFor(() => expect(screen.queryByRole("dialog", { name: "批注" })).toBeNull());
		expect(document.activeElement).toBe(mark);
		expect(mark.getAttribute("aria-expanded")).toBe("false");
	});

	it("点页边头像打开整段批注卡：计数、各区间的原文与批注都在", async () => {
		const dialog = await openBlock();
		await within(dialog).findByText("读者丙谈承载");
		expect(within(dialog).getByText("3 条批注")).toBeTruthy();
		expect(within(dialog).getByText(QUOTE_A)).toBeTruthy();
		expect(within(dialog).getByText(QUOTE_B)).toBeTruthy();
	});

	it("按评论者筛选与页边头像选中同步，被筛掉的回复草稿切回后保留", async () => {
		const dialog = await openBlock();
		fireEvent.click(await within(dialog).findByRole("button", { name: "回复 读者甲" }));
		write(within(dialog).getByRole("textbox", { name: "评论内容" }), "甲的未发回复");
		fireEvent.click(within(dialog).getByRole("button", { name: "只看 读者乙" }));
		expect(
			screen.getByRole("button", { name: "读者乙 的批注" }).getAttribute("aria-pressed"),
		).toBe("true");
		expect(
			screen.getByRole("button", { name: "读者甲 的批注" }).getAttribute("aria-pressed"),
		).toBe("false");
		expect(within(dialog).getByText("读者甲的第一条批注").closest("[hidden]")).not.toBeNull();
		expect(within(dialog).getByText("读者乙的看法").closest("[hidden]")).toBeNull();
		fireEvent.click(within(dialog).getByRole("button", { name: "只看 读者乙" }));
		expect(within(dialog).getByText("读者甲的第一条批注").closest("[hidden]")).toBeNull();
		expect(within(dialog).getByRole("textbox", { name: "评论内容" }).textContent).toBe(
			"甲的未发回复",
		);
	});

	it("批注卡打开期间头像组保持展开，点卡里的头像焦点移开也不收拢，关闭后才收拢", async () => {
		const dialog = await openBlock();
		const group = screen.getByRole("group", { name: "本段 3 条批注" });
		expect(group.getAttribute("data-open")).toBe("true");
		fireEvent.click(within(dialog).getByRole("button", { name: "只看 读者乙" }));
		expect(group.getAttribute("data-open")).toBe("true");
		fireEvent.keyDown(dialog, { key: "Escape" });
		await waitFor(() => expect(group.hasAttribute("data-open")).toBe(false));
	});
});

describe("段评", () => {
	it("已有他人批注仍能发表整段独立段评，正文与锚点不混入入口文字", async () => {
		const { dialog } = await openMark();
		await within(dialog).findByText("读者乙的看法");
		const composer = within(dialog).getByRole("group", { name: "发表段评" });
		write(within(composer).getByRole("textbox", { name: "段评内容" }), "新的独立看法");
		fireEvent.click(within(composer).getByRole("button", { name: "发送段评" }));
		await waitFor(() =>
			expect(requests.apiPost).toHaveBeenCalledWith("/posts/post-1/comments", {
				body: "新的独立看法",
				anchor: {
					block_id: blockId,
					block_text_hash: blockId,
					start_offset: 0,
					end_offset: paragraph.length,
					selected_text: paragraph,
				},
			}),
		);
		expect(screen.getByLabelText("文章正文").textContent).toBe(paragraph);
		await waitFor(() =>
			expect(within(composer).getByRole("textbox", { name: "段评内容" }).textContent).toBe(
				"",
			),
		);
		expect(within(dialog).getByText("读者甲的第一条批注")).toBeTruthy();
	});

	it("整段批注卡里同样有段评输入", async () => {
		const dialog = await openBlock();
		expect(within(dialog).getByRole("textbox", { name: "段评内容" })).toBeTruthy();
	});

	it("常驻段评输入可以添加表情，选择与关闭表情后仍保留段评草稿", async () => {
		const { dialog } = await openMark();
		const composer = within(dialog).getByRole("group", { name: "发表段评" });
		const editor = within(composer).getByRole("textbox", { name: "段评内容" });
		write(editor, "我的段落看法");
		fireEvent.click(within(composer).getByRole("button", { name: "添加表情" }));
		const picker = await screen.findByRole("dialog", { name: "表情选择器" });
		const emoji = await within(picker).findByRole("button", { name: "微笑" });
		fireEvent.click(emoji);
		expect(screen.getByRole("dialog", { name: "批注" })).toBe(dialog);
		expect(editor.textContent).toContain("我的段落看法");
		fireEvent.keyDown(emoji, { key: "Escape" });
		await waitFor(() =>
			expect(screen.queryByRole("dialog", { name: "表情选择器" })).toBeNull(),
		);
		expect(editor.textContent).toContain("我的段落看法");
	});
});

describe("回复", () => {
	it("点某条批注的「回复」展开回复表单，发送后以该批注为父评论", async () => {
		const { dialog } = await openMark();
		fireEvent.click(await within(dialog).findByRole("button", { name: "回复 读者乙" }));
		const editor = within(dialog).getByRole("textbox", { name: "评论内容" });
		write(editor, "回复读者乙");
		const form = editor.closest("form");
		if (!form) throw new Error("回复输入必须属于提交表单");
		fireEvent.click(within(form).getByRole("button", { name: /发送|提交|回复/ }));
		await waitFor(() =>
			expect(requests.apiPost).toHaveBeenCalledWith(
				"/posts/post-1/comments",
				expect.objectContaining({ body: "回复读者乙", parent_id: "c2" }),
			),
		);
	});

	it("表情portal点击保留外层和草稿，Escape先关闭内层，再关闭外层并还原焦点", async () => {
		const { mark, dialog } = await openMark();
		fireEvent.click(await within(dialog).findByRole("button", { name: "回复 读者甲" }));
		const editor = within(dialog).getByRole("textbox", { name: "评论内容" });
		write(editor, "保留草稿");
		const form = editor.closest("form");
		if (!form) throw new Error("回复输入必须属于提交表单");
		const trigger = within(form).getByRole("button", { name: "添加表情" });
		fireEvent.pointerDown(trigger);
		fireEvent.click(trigger);
		const picker = await screen.findByRole("dialog", { name: "表情选择器" });
		const emoji = await within(picker).findByRole("button", { name: "微笑" });
		fireEvent.pointerDown(emoji);
		fireEvent.click(emoji);
		expect(screen.getByRole("dialog", { name: "批注" })).toBe(dialog);
		expect(editor.textContent).toContain("保留草稿");
		fireEvent.keyDown(emoji, { key: "Escape" });
		await waitFor(() =>
			expect(screen.queryByRole("dialog", { name: "表情选择器" })).toBeNull(),
		);
		expect(screen.getByRole("dialog", { name: "批注" })).toBe(dialog);
		fireEvent.keyDown(trigger, { key: "Escape" });
		await waitFor(() => expect(screen.queryByRole("dialog", { name: "批注" })).toBeNull());
		expect(document.activeElement).toBe(mark);
	});

	it("锚点离屏隐藏全部交互与嵌套浮层而不结束草稿，滚回恢复；内部滚动不关闭", async () => {
		const { dialog } = await openMark();
		fireEvent.click(await within(dialog).findByRole("button", { name: "回复 读者甲" }));
		const editor = within(dialog).getByRole("textbox", { name: "评论内容" });
		write(editor, "滚动后仍在");
		fireEvent.scroll(editor);
		expect(screen.getByRole("dialog", { name: "批注" })).toBe(dialog);
		const form = editor.closest("form");
		if (!form) throw new Error("回复输入必须属于提交表单");
		fireEvent.click(within(form).getByRole("button", { name: "添加表情" }));
		await screen.findByRole("dialog", { name: "表情选择器" });
		anchorTop = -100;
		fireEvent.scroll(window);
		await waitFor(() => expect(screen.queryByRole("dialog", { name: "批注" })).toBeNull());
		expect(dialog.hasAttribute("inert")).toBe(true);
		await waitFor(() =>
			expect(screen.queryByRole("dialog", { name: "表情选择器" })).toBeNull(),
		);
		anchorTop = 120;
		fireEvent.scroll(window);
		await waitFor(() => expect(screen.getByRole("dialog", { name: "批注" })).toBe(dialog));
		expect(within(dialog).getByRole("textbox", { name: "评论内容" }).textContent).toBe(
			"滚动后仍在",
		);
		expect(screen.queryByRole("dialog", { name: "表情选择器" })).toBeNull();
	});

	it("真正外部点击结束会话，再打开不复活上次未发的草稿", async () => {
		const { dialog } = await openMark();
		fireEvent.click(await within(dialog).findByRole("button", { name: "回复 读者甲" }));
		write(within(dialog).getByRole("textbox", { name: "评论内容" }), "应当丢弃的草稿");
		await act(async () => {
			const { promise, resolve } = Promise.withResolvers<void>();
			setTimeout(resolve, 0);
			await promise;
		});
		const outside = screen.getByRole("button", { name: "真正外部按钮" });
		fireEvent.pointerDown(outside, { button: 0, pointerType: "mouse" });
		fireEvent.pointerUp(outside, { button: 0, pointerType: "mouse" });
		fireEvent.click(outside);
		await waitFor(() => expect(screen.queryByRole("dialog", { name: "批注" })).toBeNull());
		fireEvent.click(screen.getByRole("button", { name: `2 条批注：${QUOTE_A}` }));
		const reopened = await screen.findByRole("dialog", { name: "批注" });
		await within(reopened).findByText("读者甲的第一条批注");
		expect(within(reopened).queryByRole("textbox", { name: "评论内容" })).toBeNull();
	});
});

describe("批注中的 AI 介绍", () => {
	it("先关闭 AI 介绍再关闭批注，不因第一下 Escape 丢弃回复草稿", async () => {
		comments[0] = { ...comments[0], author_name: "GPT", is_ai: true };
		const { dialog } = await openMark();
		fireEvent.click(await within(dialog).findByRole("button", { name: "回复 GPT" }));
		const editor = within(dialog).getByRole("textbox", { name: "评论内容" });
		write(editor, "介绍关闭后仍保留");
		fireEvent.click(
			within(dialog).getAllByRole("button", { name: "查看 GPT 的 AI 形象介绍" })[0],
		);
		await screen.findByRole("dialog", { name: "GPT" });
		fireEvent.keyDown(document, { key: "Escape", cancelable: true });
		await waitFor(() => expect(screen.queryByRole("dialog", { name: "GPT" })).toBeNull());
		expect(screen.getByRole("dialog", { name: "批注" })).toBe(dialog);
		expect(editor.textContent).toBe("介绍关闭后仍保留");
		fireEvent.keyDown(document, { key: "Escape", cancelable: true });
		await waitFor(() => expect(screen.queryByRole("dialog", { name: "批注" })).toBeNull());
	});

	it("离屏时停用悬停中的 AI 介绍，滚回不自动重开且回复草稿仍在", async () => {
		comments[0] = { ...comments[0], author_name: "GPT", is_ai: true };
		const { dialog } = await openMark();
		fireEvent.click(await within(dialog).findByRole("button", { name: "回复 GPT" }));
		const editor = within(dialog).getByRole("textbox", { name: "评论内容" });
		write(editor, "滚回后仍保留");
		fireEvent.mouseEnter(
			within(dialog).getAllByRole("button", { name: "查看 GPT 的 AI 形象介绍" })[0],
		);
		const profile = await screen.findByRole("dialog", { name: "GPT" });
		fireEvent.mouseEnter(profile);
		anchorTop = -200;
		fireEvent.scroll(window);
		await waitFor(() => expect(screen.queryByRole("dialog", { name: "GPT" })).toBeNull());
		anchorTop = 120;
		fireEvent.scroll(window);
		await waitFor(() => expect(screen.getByRole("dialog", { name: "批注" })).toBe(dialog));
		expect(screen.queryByRole("dialog", { name: "GPT" })).toBeNull();
		expect(editor.textContent).toBe("滚回后仍保留");
	});
});

describe("批注卡回复的会话内可见性", () => {
	it("已有两条回复时新发第三条立即展示", async () => {
		comments[0] = {
			...comments[0],
			replies: [annotationReply("r1", "第一条回复"), annotationReply("r2", "第二条回复")],
		};
		requests.apiPost.mockResolvedValue(
			annotationReply("r3", "刚发出的第三条", { status: "pending" }),
		);
		const { dialog } = await openMark();
		await sendReply(dialog, "刚发出的第三条");

		expect(within(dialog).getByText("刚发出的第三条")).toBeTruthy();
		expect(within(dialog).getByText("第一条回复")).toBeTruthy();
		expect(within(dialog).getByText("第二条回复")).toBeTruthy();
		expect(within(dialog).queryByRole("button", { name: /展开剩余/ })).toBeNull();
	});

	it("进入卡片时折起的回复仍折叠，新回复在折叠状态下可见", async () => {
		comments[0] = {
			...comments[0],
			replies: [
				annotationReply("r1", "第一条回复"),
				annotationReply("r2", "第二条回复"),
				annotationReply("r3", "进入时的第三条"),
			],
		};
		requests.apiPost.mockResolvedValue(annotationReply("r4", "新发的第四条"));
		const { dialog } = await openMark();
		expect(within(dialog).queryByText("进入时的第三条")).toBeNull();
		await sendReply(dialog, "新发的第四条");

		expect(within(dialog).getByText("新发的第四条")).toBeTruthy();
		expect(within(dialog).queryByText("进入时的第三条")).toBeNull();
		fireEvent.click(within(dialog).getByRole("button", { name: "展开剩余 1 条" }));
		expect(within(dialog).getByText("进入时的第三条")).toBeTruthy();
	});

	it("服务端预览重拉带回新回复时不重复且保持可见", async () => {
		const first = annotationReply("r1", "第一条回复");
		const second = annotationReply("r2", "第二条回复");
		const created = annotationReply("r3", "刚发出的第三条");
		comments[0] = { ...comments[0], replies: [first, second] };
		requests.apiPost.mockImplementation(async () => {
			comments[0] = { ...comments[0], replies: [first, second, created] };
			return created;
		});
		const { dialog } = await openMark();
		const before = requests.apiGetPaged.mock.calls.length;
		await sendReply(dialog, "刚发出的第三条");
		await waitFor(() => expect(requests.apiGetPaged.mock.calls.length).toBeGreaterThan(before));
		await act(async () => {
			await Promise.all(requests.apiGetPaged.mock.results.map((result) => result.value));
		});

		expect(within(dialog).getAllByText("刚发出的第三条")).toHaveLength(1);
		expect(within(dialog).getByText("第一条回复")).toBeTruthy();
		expect(within(dialog).getByText("第二条回复")).toBeTruthy();
		expect(within(dialog).queryByRole("button", { name: /展开剩余/ })).toBeNull();
	});
});

describe("批注卡回复的目标标注", () => {
	it("直接回复批注不标目标，回复某条回复才显示对方昵称", async () => {
		comments[0] = {
			...comments[0],
			replies: [
				annotationReply("r1", "直接回复批注作者", {
					author_name: "回复者甲",
					reply_to_name: "读者甲",
				}),
				annotationReply("r2", "回复上一条回复", {
					author_name: "回复者乙",
					parent_id: "r1",
					reply_to_name: "回复者甲",
				}),
			],
		};
		const { dialog } = await openMark();
		await within(dialog).findByText("回复上一条回复");

		expect(within(dialog).getByText("回复 @回复者甲")).toBeTruthy();
		expect(within(dialog).queryByText("回复 @读者甲")).toBeNull();
	});

	it("回复目标与批注作者同名时仍按实际回复对象标注", async () => {
		comments[0] = {
			...comments[0],
			replies: [
				annotationReply("r1", "同名读者直接回复批注", {
					author_name: "读者甲",
					reply_to_name: "读者甲",
				}),
				annotationReply("r2", "回复同名读者的那条回复", {
					author_name: "回复者乙",
					parent_id: "r1",
					reply_to_name: "读者甲",
				}),
			],
		};
		const { dialog } = await openMark();
		await within(dialog).findByText("回复同名读者的那条回复");

		expect(within(dialog).getAllByText("回复 @读者甲")).toHaveLength(1);
	});
});
