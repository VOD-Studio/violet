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
let blockId: string;
let markerTop = 120;
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

async function mount(firstAuthorLabel = "读者甲 的批注") {
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
						count: 2,
						authors: comments.map((comment) => ({
							name: comment.author_name,
							avatar_url: comment.avatar_url,
							is_ai: !!comment.is_ai,
						})),
					},
				]}
			/>
		</QueryClientProvider>,
	);
	fireEvent.click(await screen.findByRole("button", { name: firstAuthorLabel }));
	await act(() => vi.dynamicImportSettled());
	return screen.findByRole("dialog", { name: "段落批注" });
}

function write(editor: HTMLElement, text: string) {
	editor.textContent = text;
	fireEvent.input(editor);
}

beforeEach(async () => {
	vi.clearAllMocks();
	markerTop = 120;
	blockId = (await computeBlockId(paragraph)) ?? "";
	comments = ["读者甲", "读者乙"].map((name, index) => ({
		id: `comment-${index}`,
		post_id: "post-1",
		depth: 0,
		author_name: name,
		avatar_url: "",
		body: `${name}已有的段评`,
		pictures: [],
		is_author: false,
		status: "approved",
		created_at: "2026-10-17T00:00:00Z",
		anchor: {
			block_id: blockId,
			block_text_hash: blockId,
			start_offset: 0,
			end_offset: paragraph.length,
			selected_text: paragraph,
		},
	}));
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
	requests.apiPost.mockResolvedValue({ ...comments[0], id: "created", body: "新的独立看法" });
	vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
		this: HTMLElement,
	) {
		return new DOMRect(
			400,
			this.hasAttribute("data-annotation-blockid") ? markerTop : 120,
			144,
			40,
		);
	});
});

afterEach(() => {
	for (const client of clients) client.clear();
	clients.length = 0;
	vi.restoreAllMocks();
});

describe("正文批注交互", () => {
	it("已有他人段评仍能发表整段独立评论，正文与锚点不混入入口文字", async () => {
		const dialog = await mount();
		write(within(dialog).getByRole("textbox", { name: "段评内容" }), "新的独立看法");
		fireEvent.click(within(dialog).getByRole("button", { name: "发送段评" }));
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
			expect(within(dialog).getByRole("textbox", { name: "段评内容" }).textContent).toBe(""),
		);
		expect(within(dialog).getByText("读者甲已有的段评")).toBeTruthy();
	});

	it("表情portal点击保留外层和草稿，Escape先关闭内层，再关闭外层并还原焦点", async () => {
		const dialog = await mount();
		fireEvent.click(await within(dialog).findByRole("button", { name: "回复批注" }));
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
		expect(screen.getByRole("dialog", { name: "段落批注" })).toBe(dialog);
		expect(editor.textContent).toContain("保留草稿");
		fireEvent.keyDown(emoji, { key: "Escape" });
		await waitFor(() =>
			expect(screen.queryByRole("dialog", { name: "表情选择器" })).toBeNull(),
		);
		expect(screen.getByRole("dialog", { name: "段落批注" })).toBe(dialog);
		fireEvent.keyDown(trigger, { key: "Escape" });
		await waitFor(() => expect(screen.queryByRole("dialog", { name: "段落批注" })).toBeNull());
		expect(document.activeElement).toBe(screen.getByRole("button", { name: "读者甲 的批注" }));
	});

	it("筛选与侧栏选中身份同步，切回时回复草稿保留", async () => {
		const dialog = await mount();
		fireEvent.click(await within(dialog).findByRole("button", { name: "回复批注" }));
		write(within(dialog).getByRole("textbox", { name: "评论内容" }), "甲的未发回复");
		fireEvent.click(within(dialog).getByRole("button", { name: "只看 读者乙" }));
		expect(
			screen.getByRole("button", { name: "读者乙 的批注" }).getAttribute("aria-pressed"),
		).toBe("true");
		expect(
			screen.getByRole("button", { name: "读者甲 的批注" }).getAttribute("aria-pressed"),
		).toBe("false");
		expect(within(dialog).queryByRole("textbox", { name: "评论内容" })).toBeNull();
		fireEvent.click(within(dialog).getByRole("button", { name: "只看 读者甲" }));
		expect(within(dialog).getByRole("textbox", { name: "评论内容" }).textContent).toBe(
			"甲的未发回复",
		);
		fireEvent.click(within(dialog).getByRole("button", { name: "只看 读者甲" }));
		expect(within(dialog).getAllByRole("button", { name: "回复批注" })).toHaveLength(1);
		expect(within(dialog).getByRole("button", { name: "取消回复" })).toBeTruthy();
	});

	it("锚点离屏隐藏所有交互而不结束草稿，滚回恢复；内部滚动不关闭", async () => {
		const dialog = await mount();
		fireEvent.click(await within(dialog).findByRole("button", { name: "回复批注" }));
		write(within(dialog).getByRole("textbox", { name: "评论内容" }), "滚动后仍在");
		fireEvent.scroll(within(dialog).getByRole("textbox", { name: "评论内容" }));
		expect(screen.getByRole("dialog", { name: "段落批注" })).toBe(dialog);
		const form = within(dialog).getByRole("textbox", { name: "评论内容" }).closest("form");
		if (!form) throw new Error("回复输入必须属于提交表单");
		fireEvent.click(within(form).getByRole("button", { name: "添加表情" }));
		await screen.findByRole("dialog", { name: "表情选择器" });
		markerTop = -100;
		fireEvent.scroll(window);
		await waitFor(() => expect(screen.queryByRole("dialog", { name: "段落批注" })).toBeNull());
		expect(dialog.hasAttribute("inert")).toBe(true);
		await waitFor(() =>
			expect(screen.queryByRole("dialog", { name: "表情选择器" })).toBeNull(),
		);
		markerTop = 120;
		fireEvent.scroll(window);
		await waitFor(() => expect(screen.getByRole("dialog", { name: "段落批注" })).toBe(dialog));
		expect(within(dialog).getByRole("textbox", { name: "评论内容" }).textContent).toBe(
			"滚动后仍在",
		);
		expect(screen.queryByRole("dialog", { name: "表情选择器" })).toBeNull();
	});

	it("真正外部点击结束会话，再打开不复活上次未发草稿", async () => {
		const dialog = await mount();
		fireEvent.click(await within(dialog).findByRole("button", { name: "回复批注" }));
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
		await waitFor(() => expect(screen.queryByRole("dialog", { name: "段落批注" })).toBeNull());
		fireEvent.click(screen.getByRole("button", { name: "读者甲 的批注" }));
		const reopened = await screen.findByRole("dialog", { name: "段落批注" });
		expect(within(reopened).queryByRole("textbox", { name: "评论内容" })).toBeNull();
	});
});

describe("批注中的 AI 介绍", () => {
	it("先关闭 AI 介绍再关闭批注，不因第一下 Escape 丢弃回复草稿", async () => {
		comments[0] = { ...comments[0], author_name: "GPT", is_ai: true };
		const dialog = await mount("GPT（AI）的批注");
		fireEvent.click(await within(dialog).findByRole("button", { name: "回复批注" }));
		const editor = within(dialog).getByRole("textbox", { name: "评论内容" });
		write(editor, "介绍关闭后仍保留");
		fireEvent.click(
			within(dialog).getAllByRole("button", { name: "查看 GPT 的 AI 形象介绍" })[0],
		);
		await screen.findByRole("dialog", { name: "GPT" });
		fireEvent.keyDown(document, { key: "Escape", cancelable: true });
		await waitFor(() => expect(screen.queryByRole("dialog", { name: "GPT" })).toBeNull());
		expect(screen.getByRole("dialog", { name: "段落批注" })).toBe(dialog);
		expect(editor.textContent).toBe("介绍关闭后仍保留");
		fireEvent.keyDown(document, { key: "Escape", cancelable: true });
		await waitFor(() => expect(screen.queryByRole("dialog", { name: "段落批注" })).toBeNull());
	});

	it("离屏时停用悬停中的 AI 介绍，滚回不自动重开且回复草稿仍在", async () => {
		comments[0] = { ...comments[0], author_name: "GPT", is_ai: true };
		const dialog = await mount("GPT（AI）的批注");
		fireEvent.click(await within(dialog).findByRole("button", { name: "回复批注" }));
		const editor = within(dialog).getByRole("textbox", { name: "评论内容" });
		write(editor, "滚回后仍保留");
		fireEvent.mouseEnter(
			within(dialog).getAllByRole("button", { name: "查看 GPT 的 AI 形象介绍" })[0],
		);
		const profile = await screen.findByRole("dialog", { name: "GPT" });
		fireEvent.mouseEnter(profile);
		markerTop = -200;
		fireEvent.scroll(window);
		await waitFor(() => expect(screen.queryByRole("dialog", { name: "GPT" })).toBeNull());
		markerTop = 120;
		fireEvent.scroll(window);
		await waitFor(() => expect(screen.getByRole("dialog", { name: "段落批注" })).toBe(dialog));
		expect(screen.queryByRole("dialog", { name: "GPT" })).toBeNull();
		expect(editor.textContent).toBe("滚回后仍保留");
	});
});

it("常驻段评输入可以添加表情，选择与关闭表情后仍保留段评草稿", async () => {
	const dialog = await mount();
	const composer = within(dialog).getByRole("group", { name: "发表段评" });
	const editor = within(composer).getByRole("textbox", { name: "段评内容" });
	write(editor, "我的段落看法");
	fireEvent.click(within(composer).getByRole("button", { name: "添加表情" }));
	const picker = await screen.findByRole("dialog", { name: "表情选择器" });
	const emoji = await within(picker).findByRole("button", { name: "微笑" });
	fireEvent.click(emoji);
	expect(screen.getByRole("dialog", { name: "段落批注" })).toBe(dialog);
	expect(editor.textContent).toContain("我的段落看法");
	fireEvent.keyDown(emoji, { key: "Escape" });
	await waitFor(() => expect(screen.queryByRole("dialog", { name: "表情选择器" })).toBeNull());
	expect(editor.textContent).toContain("我的段落看法");
});
