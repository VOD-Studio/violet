import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route } from "@/routes/admin.music";
import { createQueryClient } from "@/shared/api/query-client";

vi.mock("@/features/auth/hooks/usePermissions", () => ({
	useHasPermission: () => true,
}));

vi.mock("../../api/queries", () => ({
	useMusicStatus: () => ({
		data: {
			configured: true,
			credential_storage_ready: true,
			base_url: "http://127.0.0.1:3721",
		},
		isLoading: false,
	}),
	useMusicAccount: () => ({
		data: {
			state: "connected",
			profile: {
				id: "9527",
				nickname: "博丽灵梦",
				avatar_url: "https://example.com/reimu.png",
			},
		},
		isLoading: false,
	}),
	useFeaturedPlaylists: () => ({
		data: [
			{
				id: "1001",
				name: "东方华彩录",
				cover_url: "",
				track_count: 30,
				creator: "ZUN",
				enabled: true,
				position: 0,
			},
		],
		isLoading: false,
	}),
	useVerifyMusic: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
	}),
	useRefreshMusicAccount: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
	}),
	useDisconnectMusicAccount: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
	}),
	useSetFeaturedPlaylistEnabled: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
	}),
	useOrderFeaturedPlaylists: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
	}),
	useRemoveFeaturedPlaylist: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
	}),
	useCreateMusicLoginQR: () => ({
		mutateAsync: vi
			.fn()
			.mockResolvedValue({ id: "1", url: "https://music.163.com", expires_at: "" }),
		isPending: false,
	}),
	useCancelMusicLoginQR: () => ({
		mutate: vi.fn(),
	}),
	useMusicQrPolling: () => ({
		qrState: "waiting",
	}),
	useUserPlaylists: () => ({
		data: { data: [], pagination: { total: 0, limit: 10 } },
		isLoading: false,
	}),
	useSearchMusicPlaylists: () => ({
		data: { data: [], pagination: { total: 0, limit: 10 } },
		isLoading: false,
	}),
	usePlaylistTracks: () => ({
		data: { data: [], pagination: { total: 0, limit: 10 } },
		isLoading: false,
	}),
	useAddFeaturedPlaylist: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
	}),
}));

vi.mock("sonner", () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
	},
}));

describe("AdminMusicPage Route Integration", () => {
	let qc = createQueryClient();
	const wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={qc}>{children}</QueryClientProvider>
	);

	beforeEach(() => {
		qc = createQueryClient();
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
	});

	it("点击添加展示歌单打开弹窗", () => {
		const Component = Route.options.component;
		if (!Component) throw new Error("Component is missing");
		render(<Component />, { wrapper });

		const addBtn = screen.getByRole("button", { name: "添加歌单" });
		fireEvent.click(addBtn);

		expect(screen.getByRole("dialog", { name: "添加展示歌单" })).toBeDefined();
	});
});
