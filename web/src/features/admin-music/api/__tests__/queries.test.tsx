import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryClient } from "@/shared/api/query-client";
import type { MusicAccount } from "../../model/types";
import * as client from "../client";
import { adminMusicKeys } from "../keys";
import {
	useDisconnectMusicAccount,
	useMusicAccount,
	usePlaylistTracks,
	useRefreshMusicAccount,
	useSearchMusicPlaylists,
	useUserPlaylists,
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
});
