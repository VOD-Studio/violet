import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FloatingToolbar } from "../FloatingToolbar";

const requests = vi.hoisted(() => ({
	apiGet: vi.fn(),
	apiPost: vi.fn(),
	apiGetPaged: vi.fn(),
	apiPatch: vi.fn(),
	apiDelete: vi.fn(),
}));
vi.mock("@shared/api/request", () => requests);

const originalRect = Object.getOwnPropertyDescriptor(Range.prototype, "getBoundingClientRect");
const originalRects = Object.getOwnPropertyDescriptor(Range.prototype, "getClientRects");
const paragraph = "选中文字在滚动和编辑期间仍然保持原来的讨论范围。";
let rangeTop = 120;
let client: QueryClient;

function Harness({ toolbar = true }: { toolbar?: boolean }) {
	const contentRef = useRef<HTMLDivElement>(null);
	return (
		<>
			<div ref={contentRef} role="region" aria-label="文章正文">
				<p>{paragraph}</p>
			</div>
			{toolbar && <FloatingToolbar contentRef={contentRef} postId="post-1" isLoggedIn />}
		</>
	);
}

function renderHarness() {
	return render(
		<QueryClientProvider client={client}>
			<Harness />
		</QueryClientProvider>,
	);
}

function block() {
	const el = screen.getByLabelText("文章正文").querySelector("p");
	if (!el?.firstChild) throw new Error("缺少正文夹具");
	return el;
}

/** 选中正文开头 4 个字「选中文字」。 */
function select() {
	const range = document.createRange();
	range.setStart(block().firstChild as Text, 0);
	range.setEnd(block().firstChild as Text, 4);
	window.getSelection()?.removeAllRanges();
	window.getSelection()?.addRange(range);
	fireEvent(document, new Event("selectionchange"));
}

/** 等 requestAnimationFrame 与锚点计算落定。 */
async function settle() {
	await act(async () => {
		const { promise, resolve } = Promise.withResolvers<void>();
		setTimeout(resolve, 60);
		await promise;
	});
}

function write(editor: HTMLElement, text: string) {
	editor.textContent = text;
	fireEvent.input(editor);
}

beforeEach(() => {
	rangeTop = 120;
	requests.apiGet.mockResolvedValue([]);
	client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	Object.defineProperty(Range.prototype, "getBoundingClientRect", {
		configurable: true,
		value(this: Range) {
			return this.collapsed ? new DOMRect() : new DOMRect(120, rangeTop, 200, 20);
		},
	});
	Object.defineProperty(Range.prototype, "getClientRects", {
		configurable: true,
		value(this: Range) {
			return [this.getBoundingClientRect()];
		},
	});
});

afterEach(() => {
	vi.useRealTimers();
	client.clear();
	window.getSelection()?.removeAllRanges();
	if (originalRect) Object.defineProperty(Range.prototype, "getBoundingClientRect", originalRect);
	else Reflect.deleteProperty(Range.prototype, "getBoundingClientRect");
	if (originalRects) Object.defineProperty(Range.prototype, "getClientRects", originalRects);
	else Reflect.deleteProperty(Range.prototype, "getClientRects");
});

describe("选区工具条", () => {
	it("鼠标拖选期间不出现，松开后浮出「批注」与「复制」", async () => {
		renderHarness();
		fireEvent.pointerDown(block());
		select();
		await settle();
		expect(screen.queryByRole("toolbar", { name: "批注工具" })).toBeNull();

		fireEvent.pointerUp(block());
		const toolbar = await screen.findByRole("toolbar", { name: "批注工具" });
		expect(within(toolbar).getByRole("button", { name: "批注" })).toBeTruthy();
		expect(within(toolbar).getByRole("button", { name: "复制" })).toBeTruthy();
	});

	it("在别处按下鼠标，工具条随即消失", async () => {
		renderHarness();
		select();
		await screen.findByRole("toolbar", { name: "批注工具" });
		fireEvent.pointerDown(block());
		await waitFor(() => expect(screen.queryByRole("toolbar", { name: "批注工具" })).toBeNull());
	});

	it("键盘选中没有「松开」，选区一出现就显示，Tab 先到工具条", async () => {
		renderHarness();
		select();
		const toolbar = await screen.findByRole("toolbar", { name: "批注工具" });
		fireEvent.keyDown(document.body, { key: "Tab" });
		expect(document.activeElement).toBe(within(toolbar).getByRole("button", { name: "批注" }));
		fireEvent.keyDown(document.activeElement ?? document.body, { key: "Tab" });
		expect(toolbar.contains(document.activeElement)).toBe(true);
	});

	it("点「复制」把选中的文字写进剪贴板并收起工具条", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
		renderHarness();
		select();
		const toolbar = await screen.findByRole("toolbar", { name: "批注工具" });
		fireEvent.click(within(toolbar).getByRole("button", { name: "复制" }));
		await waitFor(() => expect(writeText).toHaveBeenCalledWith("选中文字"));
		await waitFor(() => expect(screen.queryByRole("toolbar", { name: "批注工具" })).toBeNull());
	});
});

describe("写批注", () => {
	it("⌘⇧M 打开批注卡，回车以原选区发表，卡片随后收起", async () => {
		requests.apiPost.mockResolvedValue({ id: "created", status: "approved" });
		renderHarness();
		select();
		await screen.findByRole("toolbar", { name: "批注工具" });
		fireEvent.keyDown(document, { key: "M", metaKey: true, shiftKey: true });
		const card = await screen.findByRole("dialog", { name: "新批注" });
		expect(screen.queryByRole("toolbar", { name: "批注工具" })).toBeNull();
		expect(within(card).getByText("选中文字")).toBeTruthy();
		const input = within(card).getByRole("textbox", { name: "批注内容" });
		write(input, "键盘写下的批注");
		fireEvent.keyDown(input, { key: "Enter" });
		await waitFor(() =>
			expect(requests.apiPost).toHaveBeenCalledWith(
				"/posts/post-1/comments",
				expect.objectContaining({
					body: "键盘写下的批注",
					anchor: expect.objectContaining({
						selected_text: "选中文字",
						start_offset: 0,
						end_offset: 4,
					}),
				}),
			),
		);
		await waitFor(() => expect(screen.queryByRole("dialog", { name: "新批注" })).toBeNull());
		expect(block().textContent).toBe(paragraph);
	});

	it("Ctrl+Shift+M 同样可用；没有选区时不拦截按键", async () => {
		renderHarness();
		const idle = new KeyboardEvent("keydown", {
			key: "M",
			ctrlKey: true,
			shiftKey: true,
			cancelable: true,
			bubbles: true,
		});
		document.dispatchEvent(idle);
		expect(idle.defaultPrevented).toBe(false);

		select();
		await screen.findByRole("toolbar", { name: "批注工具" });
		fireEvent.keyDown(document, { key: "M", ctrlKey: true, shiftKey: true });
		expect(await screen.findByRole("dialog", { name: "新批注" })).toBeTruthy();
	});

	it("Escape 收起批注卡并丢弃草稿", async () => {
		renderHarness();
		select();
		fireEvent.click(await screen.findByRole("button", { name: "批注" }));
		const card = await screen.findByRole("dialog", { name: "新批注" });
		write(within(card).getByRole("textbox", { name: "批注内容" }), "不要了");
		fireEvent.keyDown(document, { key: "Escape" });
		await waitFor(() => expect(screen.queryByRole("dialog", { name: "新批注" })).toBeNull());
		expect(block().querySelector("mark")).toBeNull();
	});

	it("延迟挂载时接管已有选区", async () => {
		const view = render(
			<QueryClientProvider client={client}>
				<Harness toolbar={false} />
			</QueryClientProvider>,
		);
		select();
		await settle();
		view.rerender(
			<QueryClientProvider client={client}>
				<Harness />
			</QueryClientProvider>,
		);
		const annotate = await screen.findByRole("button", { name: "批注" });
		fireEvent.click(annotate);
		const card = await screen.findByRole("dialog", { name: "新批注" });
		expect(within(card).getByRole("textbox", { name: "批注内容" })).toBeTruthy();
	});

	it("批注卡离屏后不可交互，滚回恢复同一草稿且提交原选区", async () => {
		requests.apiPost.mockResolvedValue({ id: "created", status: "approved" });
		renderHarness();
		select();
		fireEvent.click(await screen.findByRole("button", { name: "批注" }));
		const card = await screen.findByRole("dialog", { name: "新批注" });
		const input = within(card).getByRole("textbox", { name: "批注内容" });
		write(input, "始终保留的划线草稿");
		// 草稿 mark 包装真实文本节点后再滚动，旧 Range 端点若失效，此处也会丢失卡片。
		await waitFor(() => expect(block().querySelector("mark")?.textContent).toBe("选中文字"));
		fireEvent.scroll(window);
		await waitFor(() => expect(screen.getByRole("dialog", { name: "新批注" })).toBe(card));
		rangeTop = -100;
		fireEvent.scroll(window);
		await waitFor(() => expect(screen.queryByRole("dialog", { name: "新批注" })).toBeNull());
		expect(card.hasAttribute("inert")).toBe(true);
		rangeTop = 120;
		fireEvent.scroll(window);
		await waitFor(() => expect(screen.getByRole("dialog", { name: "新批注" })).toBe(card));
		expect(within(card).getByRole("textbox", { name: "批注内容" }).textContent).toBe(
			"始终保留的划线草稿",
		);
		fireEvent.click(within(card).getByRole("button", { name: "提交批注" }));
		await waitFor(() =>
			expect(requests.apiPost).toHaveBeenCalledWith(
				"/posts/post-1/comments",
				expect.objectContaining({
					body: "始终保留的划线草稿",
					anchor: expect.objectContaining({
						selected_text: "选中文字",
						start_offset: 0,
						end_offset: 4,
					}),
				}),
			),
		);
	});
});
