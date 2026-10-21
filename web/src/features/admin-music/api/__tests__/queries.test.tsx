import { createQueryClient } from "@/shared/api/query-client";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MusicAccount, MusicChallengeCheck } from "../../model/types";
import * as client from "../client";
import { adminMusicKeys } from "../keys";
import {
	useAddFeaturedPlaylist,
	useDisconnectMusicAccount,
	useFeaturedPlaylists,
	useMusicAccount,
	useMusicQrPolling,
	useMusicStatus,
	useOrderFeaturedPlaylists,
	usePlaylistTracks,
	useRefreshMusicAccount,
	useRemoveFeaturedPlaylist,
	useSearchMusicPlaylists,
	useSetFeaturedPlaylistEnabled,
	useUserPlaylists,
	useVerifyMusic,
} from "../queries";

vi.mock("../client");

describe("admin-music api queries & hooks", () => {
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

	it("useMusicStatus 与 useVerifyMusic 正常流转", async () => {
		vi.mocked(client.getMusicStatus).mockResolvedValueOnce({
			configured: true,
			credential_storage_ready: true,
			base_url: "http://kite:3721",
		});
		vi.mocked(client.verifyMusic).mockResolvedValueOnce({
			valid: true,
			message: "验证通过",
		});

		const { result } = renderHook(
			() => ({
				status: useMusicStatus(),
				verify: useVerifyMusic(),
			}),
			{ wrapper },
		);

		await waitFor(() => expect(result.current.status.isSuccess).toBe(true));
		expect(result.current.status.data?.configured).toBe(true);

		await act(async () => {
			await result.current.verify.mutateAsync();
		});
		expect(client.verifyMusic).toHaveBeenCalled();
	});

	it("useMusicAccount 及其刷新、断开变更操作同步缓存", async () => {
		const initialAccount: MusicAccount = {
			state: "connected",
			profile: { id: "100", nickname: "Rua", avatar_url: "https://avatar.png" },
		};
		const refreshedAccount: MusicAccount = {
			state: "connected",
			profile: { id: "100", nickname: "Rua_New", avatar_url: "https://avatar.png" },
		};

		vi.mocked(client.getMusicAccount).mockResolvedValueOnce(initialAccount);
		vi.mocked(client.refreshMusicAccount).mockResolvedValueOnce(refreshedAccount);
		vi.mocked(client.disconnectMusicAccount).mockResolvedValueOnce(undefined);

		const { result } = renderHook(
			() => ({
				account: useMusicAccount(),
				refresh: useRefreshMusicAccount(),
				disconnect: useDisconnectMusicAccount(),
			}),
			{ wrapper },
		);

		await waitFor(() => expect(result.current.account.isSuccess).toBe(true));
		expect(result.current.account.data?.profile?.nickname).toBe("Rua");

		await act(async () => {
			await result.current.refresh.mutateAsync();
		});
		expect(qc.getQueryData(adminMusicKeys.account())).toEqual(refreshedAccount);

		const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
		await act(async () => {
			await result.current.disconnect.mutateAsync();
		});
		expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: adminMusicKeys.account() });
		expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: adminMusicKeys.library() });
	});

	it("useFeaturedPlaylists 的增删改查与排序生效", async () => {
		vi.mocked(client.getFeaturedPlaylists).mockResolvedValueOnce([]);
		vi.mocked(client.addFeaturedPlaylist).mockResolvedValueOnce({
			id: "pl-1",
			name: "歌单1",
			cover_url: "",
			track_count: 10,
			creator: "user",
			enabled: true,
			position: 0,
		});
		vi.mocked(client.setFeaturedPlaylistEnabled).mockResolvedValueOnce({
			id: "pl-1",
			name: "歌单1",
			cover_url: "",
			track_count: 10,
			creator: "user",
			enabled: false,
			position: 0,
		});
		vi.mocked(client.orderFeaturedPlaylists).mockResolvedValueOnce([
			{
				id: "pl-1",
				name: "歌单1",
				cover_url: "",
				track_count: 10,
				creator: "user",
				enabled: false,
				position: 0,
			},
		]);
		vi.mocked(client.removeFeaturedPlaylist).mockResolvedValueOnce(undefined);

		const { result } = renderHook(
			() => ({
				list: useFeaturedPlaylists(),
				add: useAddFeaturedPlaylist(),
				toggle: useSetFeaturedPlaylistEnabled(),
				order: useOrderFeaturedPlaylists(),
				remove: useRemoveFeaturedPlaylist(),
			}),
			{ wrapper },
		);

		await waitFor(() => expect(result.current.list.isSuccess).toBe(true));

		await act(async () => {
			await result.current.add.mutateAsync({ playlist_id: "pl-1" });
			await result.current.toggle.mutateAsync({ id: "pl-1", enabled: false });
			await result.current.order.mutateAsync(["pl-1"]);
			await result.current.remove.mutateAsync("pl-1");
		});

		expect(client.addFeaturedPlaylist).toHaveBeenCalledWith({ playlist_id: "pl-1" });
		expect(client.setFeaturedPlaylistEnabled).toHaveBeenCalledWith("pl-1", { enabled: false });
		expect(client.orderFeaturedPlaylists).toHaveBeenCalledWith({ ids: ["pl-1"] });
		expect(client.removeFeaturedPlaylist).toHaveBeenCalledWith("pl-1");
	});

	it("useUserPlaylists 与 usePlaylistTracks 遵循 enabled 限制", async () => {
		vi.mocked(client.getUserPlaylists).mockResolvedValue({
			data: [],
			pagination: { page: 1, limit: 20, total: 0 },
		});
		vi.mocked(client.getPlaylistTracks).mockResolvedValue({
			data: [],
			pagination: { page: 1, limit: 20, total: 0 },
		});

		const { result } = renderHook(
			() => ({
				disabledUserPl: useUserPlaylists({}, { enabled: false }),
				enabledUserPl: useUserPlaylists({ page: 1, limit: 10 }),
				disabledTracks: usePlaylistTracks(null),
				enabledTracks: usePlaylistTracks("pl-1"),
			}),
			{ wrapper },
		);

		expect(result.current.disabledUserPl.fetchStatus).toBe("idle");
		expect(result.current.disabledTracks.fetchStatus).toBe("idle");

		await waitFor(() => expect(result.current.enabledUserPl.isSuccess).toBe(true));
		await waitFor(() => expect(result.current.enabledTracks.isSuccess).toBe(true));
	});

	it("useSearchMusicPlaylists 在关键词为空时不发起查询", async () => {
		vi.mocked(client.searchMusicPlaylists).mockResolvedValue({
			data: [],
			pagination: { page: 1, limit: 20, total: 0 },
		});

		const { result } = renderHook(() => useSearchMusicPlaylists({ q: "   " }), { wrapper });

		expect(result.current.fetchStatus).toBe("idle");
		expect(client.searchMusicPlaylists).not.toHaveBeenCalled();
	});

	it("useMusicQrPolling 轮询并在 confirmed 时调用回调并更新缓存", async () => {
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		try {
			const onConfirmed = vi.fn();
			const waitingRes: MusicChallengeCheck = { state: "waiting", account: null };
			const scannedRes: MusicChallengeCheck = { state: "scanned", account: null };
			const confirmedAccount: MusicAccount = {
				state: "connected",
				profile: { id: "123", nickname: "ConfirmedUser", avatar_url: "" },
			};
			const confirmedRes: MusicChallengeCheck = {
				state: "confirmed",
				account: confirmedAccount,
			};

			vi.mocked(client.checkMusicLoginQR)
				.mockResolvedValueOnce(waitingRes)
				.mockResolvedValueOnce(scannedRes)
				.mockResolvedValueOnce(confirmedRes);

			const { result } = renderHook(() => useMusicQrPolling("challenge-123", onConfirmed), {
				wrapper,
			});

			expect(result.current.qrState).toBe("waiting");

			// 执行第 1 次轮询
			await act(async () => {
				await vi.advanceTimersByTimeAsync(10);
			});
			expect(client.checkMusicLoginQR).toHaveBeenCalledWith("challenge-123");

			// 前进 2000ms 执行第 2 次
			await act(async () => {
				await vi.advanceTimersByTimeAsync(2000);
			});
			expect(result.current.qrState).toBe("scanned");

			// 前进 2000ms 执行第 3 次（confirmed）
			await act(async () => {
				await vi.advanceTimersByTimeAsync(2000);
			});
			expect(result.current.qrState).toBe("confirmed");
			expect(onConfirmed).toHaveBeenCalledWith(confirmedAccount);
			expect(qc.getQueryData(adminMusicKeys.account())).toEqual(confirmedAccount);
		} finally {
			vi.useRealTimers();
		}
	});
});
