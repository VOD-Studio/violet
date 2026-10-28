import { LinkPreviews } from "@entities/link-preview/ui/LinkPreviews";
import { apiPost } from "@shared/api/request";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@shared/api/csrf", () => ({ getCSRFToken: () => "csrf-token" }));
vi.mock("@shared/api/request", () => ({ apiGet: vi.fn(), apiPost: vi.fn() }));

const readyURL = "https://example.com/article";
const blockedURL = "https://blocked.example.com/";
const card = {
	url: readyURL,
	title: "后台抓取完成的页面",
	description: "等待中的链接会直接出现卡片。",
	site_name: "Example",
	image_url: "",
};

function mountPreviews(urls: string[]) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
	const view = render(
		<QueryClientProvider client={client}>
			<StrictMode>
				<LinkPreviews urls={urls} />
				<LinkPreviews urls={[urls[0]]} />
			</StrictMode>
		</QueryClientProvider>,
	);
	return { ...view, client };
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.useFakeTimers();
});

afterEach(() => {
	cleanup();
	vi.clearAllTimers();
	vi.useRealTimers();
});

describe("链接预览异步回填", () => {
	it("共享同一链接的抓取状态，完成与拒绝读取后都停止轮询", async () => {
		vi.mocked(apiPost)
			.mockResolvedValueOnce({ cards: {}, pending: [readyURL, blockedURL], unavailable: [] })
			.mockResolvedValue({
				cards: { [readyURL]: card },
				pending: [],
				unavailable: [blockedURL],
			});
		const { client } = mountPreviews([readyURL, blockedURL]);
		await act(() => vi.advanceTimersByTimeAsync(1));
		expect(screen.getAllByRole("status").map((node) => node.textContent)).toEqual([
			"正在读取链接预览…",
			"正在读取链接预览…",
		]);
		expect(apiPost).toHaveBeenCalledTimes(1);
		await act(() => vi.advanceTimersByTimeAsync(2_001));
		expect(
			screen
				.getAllByRole("link", { name: new RegExp(card.title) })
				.map((link) => link.getAttribute("href")),
		).toEqual([readyURL, readyURL]);
		expect(screen.queryByRole("status")).toBeNull();
		expect(screen.queryByRole("link", { name: /blocked/ })).toBeNull();
		const settledRequests = vi.mocked(apiPost).mock.calls.length;
		await act(() => vi.advanceTimersByTimeAsync(10_000));
		expect(apiPost).toHaveBeenCalledTimes(settledRequests);
		client.clear();
	});

	it("离开页面后停止等待链接的查询", async () => {
		vi.mocked(apiPost).mockResolvedValue({ cards: {}, pending: [readyURL], unavailable: [] });
		const { unmount, client } = mountPreviews([readyURL]);
		await act(() => vi.advanceTimersByTimeAsync(1));
		expect(screen.getAllByRole("status")).toHaveLength(2);
		unmount();
		await act(() => vi.advanceTimersByTimeAsync(10_000));
		expect(apiPost).toHaveBeenCalledTimes(1);
		client.clear();
	});
});
