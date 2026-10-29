import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
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

beforeEach(() => {
	rangeTop = 120;
	requests.apiGet.mockResolvedValue([]);
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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

it("延迟挂载时接管已有选区，同帧滚动不能取消批注入口", async () => {
	const view = render(
		<QueryClientProvider client={client}>
			<Harness toolbar={false} />
		</QueryClientProvider>,
	);
	const block = screen.getByLabelText("文章正文").querySelector("p");
	if (!block?.firstChild) throw new Error("缺少正文夹具");
	const range = document.createRange();
	range.setStart(block.firstChild, 0);
	range.setEnd(block.firstChild, 4);
	window.getSelection()?.addRange(range);
	const { promise, resolve } = Promise.withResolvers<void>();
	setTimeout(resolve, 0);
	await promise;

	vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
	view.rerender(
		<QueryClientProvider client={client}>
			<Harness />
		</QueryClientProvider>,
	);
	fireEvent.scroll(window);
	await act(() => vi.advanceTimersToNextFrame());
	const annotate = await screen.findByRole("button", { name: "划线批注" });
	fireEvent.click(annotate);
	const toolbar = screen.getByRole("toolbar", { name: "批注工具" });
	expect(within(toolbar).getByText("选中文字")).toBeTruthy();
	expect(within(toolbar).getByRole("textbox", { name: "评论内容" })).toBeTruthy();
});

it("划线编辑离屏后不可交互，滚回恢复同一草稿且提交原选区", async () => {
	requests.apiPost.mockResolvedValue({ id: "created", status: "approved" });
	render(
		<QueryClientProvider client={client}>
			<Harness />
		</QueryClientProvider>,
	);
	const block = screen.getByLabelText("文章正文").querySelector("p");
	if (!block?.firstChild) throw new Error("缺少正文夹具");
	const range = document.createRange();
	range.setStart(block.firstChild, 0);
	range.setEnd(block.firstChild, 4);
	window.getSelection()?.addRange(range);
	fireEvent(document, new Event("selectionchange"));
	const annotate = await screen.findByRole("button", { name: "划线批注" });
	fireEvent.mouseDown(annotate);
	fireEvent.click(annotate);
	const toolbar = screen.getByRole("toolbar", { name: "批注工具" });
	const editor = within(toolbar).getByRole("textbox", { name: "评论内容" });
	editor.textContent = "始终保留的划线草稿";
	fireEvent.input(editor);
	// 草稿 mark 包装真实文本节点后再滚动，旧 Range 端点若失效，此处也会丢失面板。
	await waitFor(() => expect(block.querySelector("mark")?.textContent).toBe("选中文字"));
	fireEvent.scroll(window);
	await waitFor(() => expect(screen.getByRole("toolbar", { name: "批注工具" })).toBe(toolbar));
	rangeTop = -100;
	fireEvent.scroll(window);
	await waitFor(() => expect(screen.queryByRole("toolbar", { name: "批注工具" })).toBeNull());
	expect(toolbar.hasAttribute("inert")).toBe(true);
	rangeTop = 120;
	fireEvent.scroll(window);
	await waitFor(() => expect(screen.getByRole("toolbar", { name: "批注工具" })).toBe(toolbar));
	expect(within(toolbar).getByRole("textbox", { name: "评论内容" })).toBe(editor);
	expect(editor.textContent).toBe("始终保留的划线草稿");
	fireEvent.click(within(toolbar).getByRole("button", { name: "提交批注" }));
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
	expect(block.textContent).toBe(paragraph);
});
