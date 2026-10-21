import { apiDelete, apiGet, apiGetPaged, apiPatch, apiPost, apiPut } from "@/shared/api/request";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	addFeaturedPlaylist,
	cancelMusicLoginQR,
	checkMusicLoginQR,
	createMusicLoginQR,
	disconnectMusicAccount,
	getFeaturedPlaylists,
	getMusicAccount,
	getMusicStatus,
	getPlaylistTracks,
	getUserPlaylists,
	orderFeaturedPlaylists,
	refreshMusicAccount,
	removeFeaturedPlaylist,
	searchMusicPlaylists,
	searchMusicSongs,
	setFeaturedPlaylistEnabled,
	verifyMusic,
} from "../client";

vi.mock("@/shared/api/request", () => ({
	apiGet: vi.fn(),
	apiGetPaged: vi.fn(),
	apiPost: vi.fn(),
	apiPatch: vi.fn(),
	apiPut: vi.fn(),
	apiDelete: vi.fn(),
}));

describe("admin-music api client", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("getMusicStatus 调用 GET /admin/music/status", async () => {
		vi.mocked(apiGet).mockResolvedValueOnce({
			configured: true,
			credential_storage_ready: true,
			base_url: "http://127.0.0.1:3721",
		});
		const res = await getMusicStatus();
		expect(apiGet).toHaveBeenCalledWith("/admin/music/status");
		expect(res.configured).toBe(true);
	});

	it("verifyMusic 调用 POST /admin/music/verify", async () => {
		vi.mocked(apiPost).mockResolvedValueOnce({ valid: true, message: "OK" });
		const res = await verifyMusic();
		expect(apiPost).toHaveBeenCalledWith("/admin/music/verify");
		expect(res.valid).toBe(true);
	});

	it("getMusicAccount 调用 GET /admin/music/account", async () => {
		vi.mocked(apiGet).mockResolvedValueOnce({ state: "connected", profile: null });
		const res = await getMusicAccount();
		expect(apiGet).toHaveBeenCalledWith("/admin/music/account");
		expect(res.state).toBe("connected");
	});

	it("createMusicLoginQR 调用 POST /admin/music/login/qr", async () => {
		vi.mocked(apiPost).mockResolvedValueOnce({
			id: "ch-1",
			url: "https://music.163.com/login",
			expires_at: "2026-10-21T00:00:00Z",
		});
		const res = await createMusicLoginQR();
		expect(apiPost).toHaveBeenCalledWith("/admin/music/login/qr");
		expect(res.id).toBe("ch-1");
	});

	it("checkMusicLoginQR 调用 POST /admin/music/login/qr/:id/check", async () => {
		vi.mocked(apiPost).mockResolvedValueOnce({ state: "waiting", account: null });
		const res = await checkMusicLoginQR("ch-1");
		expect(apiPost).toHaveBeenCalledWith("/admin/music/login/qr/ch-1/check");
		expect(res.state).toBe("waiting");
	});

	it("cancelMusicLoginQR 调用 DELETE /admin/music/login/qr/:id", async () => {
		vi.mocked(apiDelete).mockResolvedValueOnce(undefined);
		await cancelMusicLoginQR("ch-1");
		expect(apiDelete).toHaveBeenCalledWith("/admin/music/login/qr/ch-1");
	});

	it("refreshMusicAccount 调用 POST /admin/music/account/refresh", async () => {
		vi.mocked(apiPost).mockResolvedValueOnce({ state: "connected", profile: null });
		await refreshMusicAccount();
		expect(apiPost).toHaveBeenCalledWith("/admin/music/account/refresh");
	});

	it("disconnectMusicAccount 调用 DELETE /admin/music/account", async () => {
		vi.mocked(apiDelete).mockResolvedValueOnce(undefined);
		await disconnectMusicAccount();
		expect(apiDelete).toHaveBeenCalledWith("/admin/music/account");
	});

	it("getFeaturedPlaylists 调用 GET /admin/music/playlists", async () => {
		vi.mocked(apiGet).mockResolvedValueOnce([]);
		await getFeaturedPlaylists();
		expect(apiGet).toHaveBeenCalledWith("/admin/music/playlists");
	});

	it("addFeaturedPlaylist 调用 POST /admin/music/playlists", async () => {
		vi.mocked(apiPost).mockResolvedValueOnce({ id: "123" });
		await addFeaturedPlaylist({ playlist_id: "123" });
		expect(apiPost).toHaveBeenCalledWith("/admin/music/playlists", {
			playlist_id: "123",
		});
	});

	it("setFeaturedPlaylistEnabled 调用 PATCH /admin/music/playlists/:id", async () => {
		vi.mocked(apiPatch).mockResolvedValueOnce({ id: "123", enabled: false });
		await setFeaturedPlaylistEnabled("123", { enabled: false });
		expect(apiPatch).toHaveBeenCalledWith("/admin/music/playlists/123", {
			enabled: false,
		});
	});

	it("orderFeaturedPlaylists 调用 PUT /admin/music/playlists/order", async () => {
		vi.mocked(apiPut).mockResolvedValueOnce([]);
		await orderFeaturedPlaylists({ ids: ["1", "2"] });
		expect(apiPut).toHaveBeenCalledWith("/admin/music/playlists/order", {
			ids: ["1", "2"],
		});
	});

	it("removeFeaturedPlaylist 调用 DELETE /admin/music/playlists/:id", async () => {
		vi.mocked(apiDelete).mockResolvedValueOnce(undefined);
		await removeFeaturedPlaylist("123");
		expect(apiDelete).toHaveBeenCalledWith("/admin/music/playlists/123");
	});

	it("getUserPlaylists 调用 GET /admin/music/library/playlists 带分页参数", async () => {
		vi.mocked(apiGetPaged).mockResolvedValueOnce({
			data: [],
			pagination: { page: 2, limit: 10, total: 0 },
		});
		await getUserPlaylists({ page: 2, limit: 10 });
		expect(apiGetPaged).toHaveBeenCalledWith("/admin/music/library/playlists", {
			params: { page: 2, limit: 10 },
		});
	});

	it("searchMusicSongs 与 searchMusicPlaylists 分别带正确 type 参数调用 GET", async () => {
		vi.mocked(apiGetPaged).mockResolvedValue({
			data: [],
			pagination: { page: 1, limit: 20, total: 0 },
		});
		await searchMusicSongs({ q: "test", page: 1, limit: 20 });
		expect(apiGetPaged).toHaveBeenCalledWith("/admin/music/library/search", {
			params: { q: "test", page: 1, limit: 20, type: "song" },
		});

		await searchMusicPlaylists({ q: "rock", page: 1, limit: 10 });
		expect(apiGetPaged).toHaveBeenCalledWith("/admin/music/library/search", {
			params: { q: "rock", page: 1, limit: 10, type: "playlist" },
		});
	});

	it("getPlaylistTracks 调用 GET /admin/music/library/playlists/:id/tracks", async () => {
		vi.mocked(apiGetPaged).mockResolvedValueOnce({
			data: [],
			pagination: { page: 1, limit: 50, total: 0 },
		});
		await getPlaylistTracks("pl-1", { page: 1, limit: 50 });
		expect(apiGetPaged).toHaveBeenCalledWith("/admin/music/library/playlists/pl-1/tracks", {
			params: { page: 1, limit: 50 },
		});
	});
});
