import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import type * as KitePlayerPackage from "@violetjs/kite-player";
import { Player } from "@violetjs/kite-player";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import MusicPlayerClient from "../MusicPlayerClient";

const session = vi.hoisted(() => ({ player: null as Player | null }));
vi.mock("@violetjs/kite-player", async (original) => ({
	...(await original<typeof KitePlayerPackage>()),
	getPlayer: () => session.player,
}));
vi.mock("@violetjs/kite-player/react", () => ({
	KitePlayer: () => <div aria-label="全站播放器" role="group" />,
}));
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }));
const playlists: never[] = [];
vi.mock("../../api/queries", () => ({
	usePublicMusicPlaylists: () => ({ data: playlists }),
	usePublicPlaybackStatus: () => ({ data: { mode: "anonymous" } }),
	usePublicPlaybackDetail: () => ({ data: undefined }),
}));
vi.mock("../../api/client", () => ({
	getPublicSong: async (id: string) => ({
		id,
		name: "分享歌曲",
		artists: [],
		fee: 0,
		duration_ms: 60000,
	}),
	getPublicPlayback: async () => ({ playable: true, url: "https://example.test/audio.mp3" }),
	getPublicLyric: async () => ({ lrc: "[00:00.00]歌词", translated: "", romanized: "" }),
	musicResourceUrl: (id: string, resource: string) =>
		`https://example.test/music/${id}/${resource}`,
	getPublicPlaylistTracks: vi.fn(),
}));
class TestAudio extends EventTarget {
	src = "";
	currentTime = 0;
	duration = 60;
	paused = true;
	volume = 1;
	async play() {
		this.paused = false;
		this.dispatchEvent(new Event("play"));
	}
	pause() {
		this.paused = true;
		this.dispatchEvent(new Event("pause"));
	}
}
let mode: string | null;
beforeEach(() => {
	mode = localStorage.getItem("violet:music-playback-mode");
	session.player = new Player({ audio: new TestAudio(), storageKey: false, mediaSession: false });
});
afterEach(() => {
	cleanup();
	session.player?.destroy();
	if (mode === null) {
		localStorage.removeItem("violet:music-playback-mode");
	} else {
		localStorage.setItem("violet:music-playback-mode", mode);
	}
});
it("未配置展示歌单也能播放单曲，播放前不露出空播放器", async () => {
	render(<MusicPlayerClient />);
	const player = session.player as Player;
	await waitFor(() => expect(player.hasSource()).toBe(true));
	expect(screen.queryByRole("group", { name: "全站播放器" })).toBeNull();
	await act(async () => {
		await player.playTrack("123");
	});
	expect(player.state.current?.title).toBe("分享歌曲");
	expect(player.state.playing).toBe(true);
	expect(screen.getByRole("group", { name: "全站播放器" })).toBeTruthy();
});
