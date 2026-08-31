import { apiDelete, apiPost } from "@shared/api/request";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { useDeleteGallery, usePublishGallery, useUnpublishGallery } from "../mutations";

vi.mock("@shared/api/request", () => ({
	apiPost: vi.fn(),
	apiPut: vi.fn(),
	apiDelete: vi.fn(),
}));

describe("usePublishGallery", () => {
	it("向管理发布端点发送 expected_version", async () => {
		const queryClient = new QueryClient({
			defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
		});
		vi.mocked(apiPost).mockResolvedValue({
			id: "gallery-1",
			slug: "summer-light",
			status: "published",
		});
		const { result } = renderHook(() => usePublishGallery("gallery-1"), {
			wrapper: ({ children }: { children: ReactNode }) => (
				<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
			),
		});

		await act(async () => {
			await result.current.mutateAsync({ expected_version: 4 });
		});

		expect(apiPost).toHaveBeenCalledWith("/admin/galleries/gallery-1/publish", {
			expected_version: 4,
		});
	});
});

describe("useUnpublishGallery", () => {
	it("向撤回端点发送 expected_version", async () => {
		const queryClient = new QueryClient({
			defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
		});
		vi.mocked(apiPost).mockResolvedValue({
			id: "gallery-1",
			slug: "summer-light",
			status: "unpublished",
		});
		const { result } = renderHook(() => useUnpublishGallery("gallery-1"), {
			wrapper: ({ children }: { children: ReactNode }) => (
				<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
			),
		});

		await act(async () => {
			await result.current.mutateAsync({ expected_version: 5 });
		});

		expect(apiPost).toHaveBeenCalledWith("/admin/galleries/gallery-1/unpublish", {
			expected_version: 5,
		});
	});
});

describe("useDeleteGallery", () => {
	it("在 DELETE 请求体中发送 expected_version", async () => {
		const queryClient = new QueryClient({
			defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
		});
		vi.mocked(apiDelete).mockResolvedValue(null);
		const { result } = renderHook(() => useDeleteGallery("gallery-1", "summer-light"), {
			wrapper: ({ children }: { children: ReactNode }) => (
				<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
			),
		});

		await act(async () => {
			await result.current.mutateAsync({ expected_version: 6 });
		});

		expect(apiDelete).toHaveBeenCalledWith("/admin/galleries/gallery-1", {
			data: { expected_version: 6 },
		});
	});
});
