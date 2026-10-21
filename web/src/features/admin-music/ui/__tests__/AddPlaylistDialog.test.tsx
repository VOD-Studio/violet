import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AddPlaylistDialog } from "../AddPlaylistDialog";

const mockAddMutateAsync = vi.fn();

vi.mock("../../api/queries", () => ({
	useAddFeaturedPlaylist: () => ({
		mutateAsync: mockAddMutateAsync,
		isPending: false,
	}),
	useUserPlaylists: () => ({
		data: {
			data: [
				{
					id: "999",
					name: "我的年度歌单",
					cover_url: "",
					track_count: 50,
					creator: "Me",
				},
			],
			pagination: { total: 1, page: 1, limit: 10 },
		},
		isLoading: false,
	}),
	useSearchMusicPlaylists: () => ({
		data: {
			data: [],
			pagination: { total: 0, page: 1, limit: 10 },
		},
		isLoading: false,
	}),
}));

vi.mock("sonner", () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
	},
}));

describe("AddPlaylistDialog", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
	});

	it("展示账号歌单库并允许选入", () => {
		render(
			<AddPlaylistDialog
				open={true}
				onOpenChange={vi.fn()}
				account={{
					state: "connected",
					profile: { id: "1", nickname: "Rua", avatar_url: "" },
				}}
				featuredPlaylists={[]}
				onOpenQrLogin={vi.fn()}
			/>,
		);

		expect(screen.getByText("添加展示歌单")).toBeDefined();
		expect(screen.getByText("我的年度歌单")).toBeDefined();
		const selectBtn = screen.getByText("选入");
		fireEvent.click(selectBtn);
		expect(mockAddMutateAsync).toHaveBeenCalledWith({ playlist_id: "999" });
	});

	it("已添加的歌单按钮为禁用态", () => {
		render(
			<AddPlaylistDialog
				open={true}
				onOpenChange={vi.fn()}
				account={{
					state: "connected",
					profile: { id: "1", nickname: "Rua", avatar_url: "" },
				}}
				featuredPlaylists={[
					{
						id: "999",
						name: "我的年度歌单",
						cover_url: "",
						track_count: 50,
						creator: "Me",
						enabled: true,
						position: 0,
					},
				]}
				onOpenQrLogin={vi.fn()}
			/>,
		);

		expect(screen.getByText("已添加")).toBeDefined();
	});
});
