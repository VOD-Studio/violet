/**
 * gallery mutations 请求契约测试
 *
 * 验证建/编图集的 URL 与请求体形态——items 全量替换语义是 PRD-0022 的
 * 关键契约（编辑页靠它一次提交增删改排序），后端 PATCH 对 items 省略
 * （不改动）与空数组（拒绝）语义不同，body 形态错会静默丢数据。
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@shared/api/request", () => ({
	apiGet: vi.fn(),
	apiPost: vi.fn(),
	apiPatch: vi.fn(),
}));

import { apiPatch, apiPost } from "@shared/api/request";
import type { GalleryDetail } from "../../model/types";
import { galleryKeys } from "../keys";
import { useCreateGallery, useUpdateGallery } from "../mutations";

function createWrapper(qc: QueryClient) {
	return ({ children }: { children: React.ReactNode }) => (
		<QueryClientProvider client={qc}>{children}</QueryClientProvider>
	);
}

function makeDetail(): GalleryDetail {
	return {
		id: "g1",
		title: "t",
		description: "",
		cover_url: "",
		preview_urls: [],
		item_count: 1,
		status: "published",
		author: { id: "u1", username: "alice", avatar_url: "" },
		created_at: "2026-01-01T00:00:00Z",
		updated_at: "2026-01-01T00:00:00Z",
		items: [],
	};
}

describe("useCreateGallery — 请求契约", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("POST /galleries 且 items 原样透传（含空 caption）", async () => {
		vi.mocked(apiPost).mockResolvedValue(makeDetail());
		const qc = new QueryClient();
		const { result } = renderHook(() => useCreateGallery(), { wrapper: createWrapper(qc) });

		result.current.mutate({
			title: "壁纸合集",
			description: "desc",
			items: [
				{ file_id: "f1", caption: "" },
				{ file_id: "f2", caption: "第二张" },
			],
		});
		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		expect(apiPost).toHaveBeenCalledWith("/galleries", {
			title: "壁纸合集",
			description: "desc",
			items: [
				{ file_id: "f1", caption: "" },
				{ file_id: "f2", caption: "第二张" },
			],
		});
	});
});

describe("useUpdateGallery — 请求契约与缓存回写", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("PATCH /galleries/{id} 且成功后回写 detail 缓存", async () => {
		const detail = { ...makeDetail(), title: "改后" };
		vi.mocked(apiPatch).mockResolvedValue(detail);
		const qc = new QueryClient();
		// setQueriesData 只更新已有缓存：编辑页打开时 detail 已加载，先 seed 再验证覆盖
		qc.setQueryData(galleryKeys.detail("g1"), makeDetail());
		const { result } = renderHook(() => useUpdateGallery("g1"), {
			wrapper: createWrapper(qc),
		});

		result.current.mutate({
			title: "改后",
			description: "",
			items: [{ file_id: "f1", caption: "" }],
		});
		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		expect(apiPatch).toHaveBeenCalledWith("/galleries/g1", {
			title: "改后",
			description: "",
			items: [{ file_id: "f1", caption: "" }],
		});
		expect(qc.getQueryData(galleryKeys.detail("g1"))).toEqual(detail);
	});
});
