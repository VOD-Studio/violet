import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AnnotationLayer } from "../AnnotationLayer";

vi.mock("@shared/api/request", () => ({
	apiGet: vi.fn(),
	apiGetPaged: vi.fn(),
	apiPost: vi.fn(),
	apiPatch: vi.fn(),
	apiDelete: vi.fn(),
}));

const originalRects = Object.getOwnPropertyDescriptor(Range.prototype, "getClientRects");
let client: QueryClient;

function Harness() {
	const contentRef = useRef<HTMLDivElement>(null);
	return (
		<>
			<div ref={contentRef} role="region" aria-label="文章正文">
				<p>刷新页面后第一次选中文字就应该是荧光笔。</p>
			</div>
			<AnnotationLayer contentRef={contentRef} summary={[]} postId="post-1" />
		</>
	);
}

beforeEach(() => {
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	Object.defineProperty(Range.prototype, "getClientRects", {
		configurable: true,
		value: () => [new DOMRect(10, 10, 120, 20)],
	});
});

afterEach(() => {
	vi.useRealTimers();
	client.clear();
	window.getSelection()?.removeAllRanges();
	if (originalRects) Object.defineProperty(Range.prototype, "getClientRects", originalRects);
	else Reflect.deleteProperty(Range.prototype, "getClientRects");
});

it("第一次选中文字就画上荧光笔笔触，不必等选区工具条的模块加载", async () => {
	vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
	render(
		<QueryClientProvider client={client}>
			<Harness />
		</QueryClientProvider>,
	);
	const paragraph = screen.getByLabelText("文章正文").querySelector("p");
	if (!paragraph?.firstChild) throw new Error("缺少正文夹具");
	const range = document.createRange();
	range.setStart(paragraph.firstChild, 0);
	range.setEnd(paragraph.firstChild, 6);
	window.getSelection()?.addRange(range);
	fireEvent(document, new Event("selectionchange"));
	await act(() => vi.advanceTimersToNextFrame());
	expect(paragraph.hasAttribute("data-selection-painted")).toBe(true);
});
