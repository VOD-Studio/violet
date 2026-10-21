import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MusicFeaturedPlaylist } from "../../model/types";
import { FeaturedPlaylistsTable } from "../FeaturedPlaylistsTable";

const mockToggleMutateAsync = vi.fn();
const mockOrderMutateAsync = vi.fn();
const mockRemoveMutateAsync = vi.fn();

vi.mock("@/features/auth/hooks/usePermissions", () => ({
	useHasPermission: () => true,
}));

vi.mock("../../api/queries", () => ({
	useSetFeaturedPlaylistEnabled: () => ({
		mutateAsync: mockToggleMutateAsync,
		isPending: false,
	}),
	useOrderFeaturedPlaylists: () => ({
		mutateAsync: mockOrderMutateAsync,
		isPending: false,
	}),
	useRemoveFeaturedPlaylist: () => ({
		mutateAsync: mockRemoveMutateAsync,
		isPending: false,
	}),
}));

vi.mock("sonner", () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
	},
}));

describe("FeaturedPlaylistsTable", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
	});

	const samplePlaylists: MusicFeaturedPlaylist[] = [
		{
			id: "1001",
			name: "东方华彩录",
			cover_url: "https://example.com/cover1.jpg",
			track_count: 42,
			creator: "ZUN",
			enabled: true,
			position: 0,
		},
		{
			id: "1002",
			name: "ACG 精选集",
			cover_url: "",
			track_count: 20,
			creator: "Anon",
			enabled: false,
			position: 1,
		},
	];

	it("渲染展示歌单并响应曲目查看点击", () => {
		const onViewTracks = vi.fn();
		render(<FeaturedPlaylistsTable playlists={samplePlaylists} onViewTracks={onViewTracks} />);

		const trackBtn = screen.getAllByText("曲目")[0];
		if (!trackBtn) throw new Error("Track button not found");
		fireEvent.click(trackBtn);
		expect(onViewTracks).toHaveBeenCalledWith(samplePlaylists[0]);
	});

	it("切换公开开关触发 mutateAsync", async () => {
		render(<FeaturedPlaylistsTable playlists={samplePlaylists} onViewTracks={vi.fn()} />);

		const firstSwitch = screen.getAllByRole("switch")[0];
		if (!firstSwitch) throw new Error("Switch not found");
		fireEvent.click(firstSwitch);
		expect(mockToggleMutateAsync).toHaveBeenCalledWith({
			id: "1001",
			enabled: false,
		});
	});

	it("点击移动按钮触发重新排序", async () => {
		render(<FeaturedPlaylistsTable playlists={samplePlaylists} onViewTracks={vi.fn()} />);

		const firstDownBtn = screen.getAllByTitle("下移")[0] as HTMLButtonElement | undefined;
		if (!firstDownBtn) throw new Error("Down button not found");
		expect(firstDownBtn.disabled).toBe(false);
		fireEvent.click(firstDownBtn);

		expect(mockOrderMutateAsync).toHaveBeenCalledWith(["1002", "1001"]);
	});
});
