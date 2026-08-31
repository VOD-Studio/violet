import { apiPost } from "@shared/api/request";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { usePublishGallery } from "../mutations";

vi.mock("@shared/api/request", () => ({
	apiPost: vi.fn(),
	apiPut: vi.fn(),
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
