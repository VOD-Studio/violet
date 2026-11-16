import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MusicShareCard } from "../MusicShareCard";

const playback = vi.hoisted(() => ({
	state: {
		current: null as { id: string } | null,
		playing: false,
		error: null as { message: string } | null,
	},
	hasSource: vi.fn(() => true),
	playTrack: vi.fn(async (_id: string) => {}),
	pause: vi.fn(),
	listener: undefined as (() => void) | undefined,
	unsubscribe: vi.fn(),
}));
vi.mock("@violetjs/kite-player", () => ({
	getPlayer: () => ({
		...playback,
		subscribe: (listener: () => void) => {
			playback.listener = listener;
			return playback.unsubscribe;
		},
	}),
}));
const song = {
	track_id: "347230",
	title: "雨の日",
	artists: ["歌手"],
	duration_ms: 297000,
	cover_url: "",
};
beforeEach(() => {
	vi.clearAllMocks();
	playback.state = { current: null, playing: false, error: null };
	playback.playTrack.mockResolvedValue(undefined);
	playback.hasSource.mockReturnValue(true);
});
afterEach(cleanup);

it("按歌曲 ID 交给站点播放器，其他入口的播放状态也同步到卡片", async () => {
	render(<MusicShareCard song={song} />);
	fireEvent.click(screen.getByRole("button", { name: "播放 雨の日" }));
	await waitFor(() => expect(playback.playTrack).toHaveBeenCalledWith("347230"));
	act(() => {
		playback.state.current = { id: "347230" };
		playback.state.playing = true;
		playback.listener?.();
	});
	fireEvent.click(screen.getByRole("button", { name: "暂停 雨の日" }));
	expect(playback.pause).toHaveBeenCalledOnce();
	act(() => {
		playback.state.current = { id: "other" };
		playback.listener?.();
	});
	expect(screen.getByRole("button", { name: "播放 雨の日" }).getAttribute("aria-pressed")).toBe(
		"false",
	);
});

it("播放失败保留歌曲资料并允许再次发起播放", async () => {
	playback.playTrack.mockRejectedValueOnce(new Error("该歌曲暂无播放权限"));
	render(<MusicShareCard song={song} />);
	fireEvent.click(screen.getByRole("button", { name: "播放 雨の日" }));
	expect((await screen.findByRole("alert")).textContent).toContain("该歌曲暂无播放权限");
	expect(screen.getByText("歌手 · 4:57")).toBeTruthy();
	fireEvent.click(screen.getByRole("button", { name: "播放 雨の日" }));
	await waitFor(() => expect(playback.playTrack).toHaveBeenCalledTimes(2));
	await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
});

it("播放器未装配时不留下永远等待的加载状态", () => {
	playback.hasSource.mockReturnValue(false);
	render(<MusicShareCard song={song} />);
	fireEvent.click(screen.getByRole("button", { name: "播放 雨の日" }));
	expect(screen.getByRole("alert").textContent).toContain("播放器尚未就绪");
	expect(playback.playTrack).not.toHaveBeenCalled();
});
