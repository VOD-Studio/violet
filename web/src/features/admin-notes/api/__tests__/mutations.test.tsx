import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCreateNote, useDeleteNote, usePublishNote } from "../mutations";

vi.mock("@shared/api/request", () => ({
	apiGet: vi.fn(),
	apiGetPaged: vi.fn(),
	apiPost: vi.fn(),
	apiPut: vi.fn(),
	apiDelete: vi.fn(),
}));

import { apiDelete, apiPost } from "@shared/api/request";

const mockPost = vi.mocked(apiPost);
const mockDelete = vi.mocked(apiDelete);

function createWrapper() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	return ({ children }: { children: ReactNode }) =>
		createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
	mockPost.mockReset();
	mockDelete.mockReset();
});

describe("useCreateNote", () => {
	it("POST /admin/notes 并携带拆分后的标签", async () => {
		mockPost.mockResolvedValue({ id: "n1", status: "draft" } as never);
		const { result } = renderHook(() => useCreateNote(), {
			wrapper: createWrapper(),
		});
		result.current.mutate({ title: "T", content_md: "正文", tags: ["redis"] });
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(mockPost).toHaveBeenCalledWith("/admin/notes", {
			title: "T",
			content_md: "正文",
			tags: ["redis"],
		});
	});
});

describe("usePublishNote", () => {
	it("POST 发布端点", async () => {
		mockPost.mockResolvedValue({ id: "n1", status: "published" } as never);
		const { result } = renderHook(() => usePublishNote("n1"), {
			wrapper: createWrapper(),
		});
		result.current.mutate();
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(mockPost).toHaveBeenCalledWith("/admin/notes/n1/publish");
	});
});

describe("useDeleteNote", () => {
	it("DELETE 端点", async () => {
		mockDelete.mockResolvedValue(null as never);
		const { result } = renderHook(() => useDeleteNote("n1"), {
			wrapper: createWrapper(),
		});
		result.current.mutate();
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(mockDelete).toHaveBeenCalledWith("/admin/notes/n1");
	});
});
