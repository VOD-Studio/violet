import type { Tweet } from "@entities/tweet/model/types";
import type { UserProfile } from "@entities/user/model/types";
import { useUserTimeline } from "@features/tweets/api/queries";
import type { PagedResponse } from "@shared/api/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { Route } from "../$username";

vi.mock("@shared/api/request", () => ({
	apiGet: vi.fn(),
	apiGetPaged: vi.fn(),
}));

import { apiGet, apiGetPaged } from "@shared/api/request";

function createWrapper(qc: QueryClient) {
	return function Wrapper({ children }: { children: ReactNode }) {
		return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
	};
}

describe("/users/$username Route.loader", () => {
	it("prefetches profile and timeline into QueryClient cache compatible with useUserTimeline", async () => {
		const qc = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});

		const mockProfile: UserProfile = {
			id: "u1",
			username: "大鸟哥",
			avatar_url: "",
			bio: "Hello bio",
			created_at: "2026-01-01T00:00:00Z",
		};

		const mockTimeline: PagedResponse<Tweet> = {
			data: [
				{
					id: "t1",
					author: { id: "u1", username: "大鸟哥", avatar_url: "" },
					content: "推文1",
					images: [],
					like_count: 5,
					comment_count: 1,
					quote_count: 0,
					is_liked: false,
					created_at: "2026-01-01T00:00:00Z",
				},
			],
			pagination: {
				has_more: false,
				limit: 20,
				next_cursor: undefined,
			},
		};

		vi.mocked(apiGet).mockResolvedValue(mockProfile);
		vi.mocked(apiGetPaged).mockResolvedValue(mockTimeline);

		// Execute loader
		const profile = await (Route.options.loader as any)({
			context: { queryClient: qc },
			params: { username: "大鸟哥" },
		});

		expect(profile).toEqual(mockProfile);

		// Verify that rendering useUserTimeline hook does NOT throw TypeError and reads prefetched data
		const { result } = renderHook(() => useUserTimeline("大鸟哥"), {
			wrapper: createWrapper(qc),
		});

		expect(result.current.data?.pages[0].data[0].content).toBe("推文1");
	});
});
