import { apiGetPaged } from "@shared/api/request";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { HomePublicationItem, PublicationWindow } from "../../types";
import { fetchPublicationWindow } from "../client";

vi.mock("@shared/api/request", () => ({
	apiGet: vi.fn(),
	apiGetPaged: vi.fn(),
	apiPost: vi.fn(),
}));

const PUBLICATION_WINDOW: PublicationWindow = {
	from: "2025-10-01T00:00:00.000Z",
	to: "2026-10-01T00:00:00.000Z",
};

function publication(id: string): HomePublicationItem {
	return {
		id,
		kind: "article",
		route_key: id,
		title: id,
		published_at: "2026-09-01T00:00:00Z",
		featured: false,
	};
}

describe("fetchPublicationWindow", () => {
	afterEach(() => {
		vi.resetAllMocks();
	});

	it("continues every cursor page and preserves server order", async () => {
		vi.mocked(apiGetPaged)
			.mockResolvedValueOnce({
				data: [publication("article:2")],
				pagination: { limit: 100, has_more: true, next_cursor: "cursor-1" },
			})
			.mockResolvedValueOnce({
				data: [publication("article:1")],
				pagination: { limit: 100, has_more: false },
			});

		await expect(fetchPublicationWindow(PUBLICATION_WINDOW)).resolves.toEqual([
			publication("article:2"),
			publication("article:1"),
		]);
		expect(apiGetPaged).toHaveBeenNthCalledWith(1, "/publications", {
			params: { ...PUBLICATION_WINDOW, cursor: undefined, limit: 100 },
		});
		expect(apiGetPaged).toHaveBeenNthCalledWith(2, "/publications", {
			params: { ...PUBLICATION_WINDOW, cursor: "cursor-1", limit: 100 },
		});
	});

	it("rejects an incomplete cursor contract instead of returning partial data", async () => {
		vi.mocked(apiGetPaged).mockResolvedValue({
			data: [publication("article:2")],
			pagination: { limit: 100, has_more: true },
		});

		await expect(fetchPublicationWindow(PUBLICATION_WINDOW)).rejects.toThrow(
			"发布物分页未返回可继续的唯一游标",
		);
	});

	it("rejects a repeated cursor instead of looping forever", async () => {
		vi.mocked(apiGetPaged)
			.mockResolvedValueOnce({
				data: [publication("article:2")],
				pagination: { limit: 100, has_more: true, next_cursor: "cursor-1" },
			})
			.mockResolvedValueOnce({
				data: [publication("article:1")],
				pagination: { limit: 100, has_more: true, next_cursor: "cursor-1" },
			});

		await expect(fetchPublicationWindow(PUBLICATION_WINDOW)).rejects.toThrow(
			"发布物分页未返回可继续的唯一游标",
		);
	});
});
