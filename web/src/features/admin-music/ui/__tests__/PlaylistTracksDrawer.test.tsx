import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MusicFeaturedPlaylist } from "../../model/types";
import { PlaylistTracksDrawer } from "../PlaylistTracksDrawer";

vi.mock("../../api/queries", () => ({
	usePlaylistTracks: () => ({
		data: {
			data: [
				{
					id: "s-1",
					name: "Bad Apple!!",
					artists: [{ id: "a-1", name: "nomico" }],
					album: { id: "al-1", name: "Alstroemeria", cover_url: "" },
					duration_ms: 318000,
				},
			],
			pagination: { total: 1, page: 1, limit: 20 },
		},
		isLoading: false,
	}),
}));

describe("PlaylistTracksDrawer", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
	});

	const playlist: MusicFeaturedPlaylist = {
		id: "123",
		name: "东方同人曲精选",
		cover_url: "",
		track_count: 1,
		creator: "博丽灵梦",
		enabled: true,
		position: 0,
	};

	it("展示曲目列表与格式化时长", () => {
		render(<PlaylistTracksDrawer playlist={playlist} open={true} onOpenChange={vi.fn()} />);

		expect(screen.getByText("东方同人曲精选")).toBeDefined();
		expect(screen.getByText("Bad Apple!!")).toBeDefined();
		expect(screen.getByText("nomico")).toBeDefined();
		expect(screen.getByText("Alstroemeria")).toBeDefined();
		// 318000 ms = 5分18秒 = 05:18
		expect(screen.getByText("05:18")).toBeDefined();
	});
});
