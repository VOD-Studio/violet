import { apiGetPaged } from "@shared/api/request";
import type { PagedResponse } from "@shared/api/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PostViewRecord } from "../../model/types";
import { PostViewsDialog } from "../PostViewsDialog";

vi.mock("@shared/api/request", () => ({ apiGet: vi.fn(), apiGetPaged: vi.fn() }));

const page = (
	records: PostViewRecord[],
	total = records.length,
): PagedResponse<PostViewRecord> => ({
	data: records,
	pagination: {
		page: 1,
		limit: 50,
		total,
		total_pages: Math.ceil(total / 50),
		has_more: total > 50,
	},
});
const record: PostViewRecord = {
	id: "1",
	ip_address: "192.0.2.1",
	user_agent: "Browser with a complete user agent",
	created_at: "2026-11-17T10:00:00Z",
};

afterEach(() => vi.resetAllMocks());

describe("PostViewsDialog", () => {
	it("changes articles without showing the previous article's records", async () => {
		const second = Promise.withResolvers<PagedResponse<PostViewRecord>>();
		vi.mocked(apiGetPaged)
			.mockResolvedValueOnce(page([record]))
			.mockReturnValueOnce(second.promise);
		const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		const show = (id: string) => (
			<QueryClientProvider client={client}>
				<PostViewsDialog post={{ id, title: id, view_count: 90 }} onClose={() => {}} />
			</QueryClientProvider>
		);
		const view = render(show("first"));
		expect(await screen.findByText("192.0.2.1")).toBeTruthy();
		expect(screen.getByText("可查询记录 1 条")).toBeTruthy();
		fireEvent.click(screen.getByLabelText("查看完整 User-Agent"));
		expect(screen.getByLabelText("查看完整 User-Agent").closest("details")?.open).toBe(true);
		view.rerender(show("second"));
		expect(screen.queryByText("192.0.2.1")).toBeNull();
		await waitFor(() =>
			expect(apiGetPaged).toHaveBeenLastCalledWith("/admin/posts/second/views", {
				params: { page: 1, limit: 50 },
			}),
		);
		second.resolve(page([]));
		expect(await screen.findByText("暂无浏览记录")).toBeTruthy();
		expect(screen.queryByText("192.0.2.1")).toBeNull();
	});

	it("requests and displays the next server page", async () => {
		vi.mocked(apiGetPaged)
			.mockResolvedValueOnce(page([record], 51))
			.mockResolvedValueOnce({
				data: [{ ...record, id: "51", ip_address: "192.0.2.51" }],
				pagination: { page: 2, limit: 50, total: 51 },
			});
		const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		render(
			<QueryClientProvider client={client}>
				<PostViewsDialog
					post={{ id: "paged", title: "paged", view_count: 51 }}
					onClose={() => {}}
				/>
			</QueryClientProvider>,
		);
		await screen.findByText("192.0.2.1");
		fireEvent.click(screen.getByRole("button", { name: "下一页" }));
		expect(await screen.findByText("192.0.2.51")).toBeTruthy();
		expect(screen.queryByText("192.0.2.1")).toBeNull();
		expect(apiGetPaged).toHaveBeenLastCalledWith("/admin/posts/paged/views", {
			params: { page: 2, limit: 50 },
		});
	});

	it("shows the actual failure and retries to a real empty result", async () => {
		vi.mocked(apiGetPaged)
			.mockRejectedValueOnce(new Error("文章不存在或已彻底删除"))
			.mockResolvedValueOnce(page([]));
		const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		render(
			<QueryClientProvider client={client}>
				<PostViewsDialog
					post={{ id: "deleted", title: "deleted", view_count: 0 }}
					onClose={() => {}}
				/>
			</QueryClientProvider>,
		);
		expect(await screen.findByText("文章不存在或已彻底删除")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: /重试/ }));
		expect(await screen.findByText("暂无浏览记录")).toBeTruthy();
	});
});
