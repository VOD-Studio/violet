import { musicKeys } from "@entities/music/api/keys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { PageQuery } from "@/shared/api/types";
import type {
	AddFeaturedPlaylistRequest,
	MusicAccount,
	MusicChallenge,
	MusicQrState,
	SearchMusicLibraryQuery,
} from "../model/types";
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
	setFeaturedPlaylistEnabled,
	verifyMusic,
} from "./client";
import { adminMusicKeys } from "./keys";

/** 查询 Kite 连接与凭据配置状态 */
export const useMusicStatus = () =>
	useQuery({
		queryKey: adminMusicKeys.status(),
		queryFn: getMusicStatus,
	});

/** 手动测试 Kite 连通性与共享令牌 */
export const useVerifyMusic = () =>
	useMutation({
		mutationFn: verifyMusic,
	});

/** 查询站点网易云账号连接状态与资料 */
export const useMusicAccount = () =>
	useQuery({
		queryKey: adminMusicKeys.account(),
		queryFn: getMusicAccount,
	});

/** 刷新站点网易云账号会话凭据 */
export const useRefreshMusicAccount = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: refreshMusicAccount,
		onSuccess: (account) => {
			qc.setQueryData(adminMusicKeys.account(), account);
		},
	});
};

/** 断开当前站点网易云账号连接 */
export const useDisconnectMusicAccount = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: disconnectMusicAccount,
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: adminMusicKeys.account() });
			qc.invalidateQueries({ queryKey: adminMusicKeys.library() });
		},
	});
};

/** 发起网易云扫码登录挑战 */
export const useCreateMusicLoginQR = () =>
	useMutation({
		mutationFn: createMusicLoginQR,
	});

/** 取消扫码登录挑战 */
export const useCancelMusicLoginQR = () =>
	useMutation({
		mutationFn: cancelMusicLoginQR,
	});

/** 获取站点展示歌单全量列表 */
export const useFeaturedPlaylists = () =>
	useQuery({
		queryKey: adminMusicKeys.featured(),
		queryFn: getFeaturedPlaylists,
	});

/** 添加展示歌单 */
export const useAddFeaturedPlaylist = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: AddFeaturedPlaylistRequest) => addFeaturedPlaylist(body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: adminMusicKeys.featured() });
			qc.invalidateQueries({ queryKey: musicKeys.playlists() });
		},
	});
};

/** 切换展示歌单公开展示状态 */
export const useSetFeaturedPlaylistEnabled = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
			setFeaturedPlaylistEnabled(id, { enabled }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: adminMusicKeys.featured() });
			qc.invalidateQueries({ queryKey: musicKeys.playlists() });
		},
	});
};

/** 保存展示歌单全量排序 */
export const useOrderFeaturedPlaylists = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (ids: string[]) => orderFeaturedPlaylists({ ids }),
		onSuccess: (data) => {
			qc.setQueryData(adminMusicKeys.featured(), data);
			qc.invalidateQueries({ queryKey: musicKeys.playlists() });
		},
	});
};

/** 从展示列表中移除歌单引用 */
export const useRemoveFeaturedPlaylist = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => removeFeaturedPlaylist(id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: adminMusicKeys.featured() });
			qc.invalidateQueries({ queryKey: musicKeys.playlists() });
		},
	});
};

/** 分页查询站点网易云账号歌单库 */
export const useUserPlaylists = (query: PageQuery = {}, options?: { enabled?: boolean }) =>
	useQuery({
		queryKey: adminMusicKeys.libraryPlaylists(query),
		queryFn: () => getUserPlaylists(query),
		enabled: options?.enabled ?? true,
	});

/** 分页搜索网易云公开歌单 */
export const useSearchMusicPlaylists = (
	query: Omit<SearchMusicLibraryQuery, "type">,
	options?: { enabled?: boolean },
) =>
	useQuery({
		queryKey: adminMusicKeys.librarySearch({ ...query, type: "playlist" }),
		queryFn: () => searchMusicPlaylists(query),
		enabled: (options?.enabled ?? true) && Boolean(query.q?.trim()),
	});

/** 分页查询指定歌单的曲目列表 */
export const usePlaylistTracks = (
	playlistId: string | null,
	query: PageQuery = {},
	options?: { enabled?: boolean },
) =>
	useQuery({
		queryKey: adminMusicKeys.libraryTracks(playlistId ?? "", query),
		queryFn: () => getPlaylistTracks(playlistId ?? "", query),
		enabled: (options?.enabled ?? true) && Boolean(playlistId),
	});

/**
 * 按挑战有效期轮询扫码状态；错误、过期或确认后停止，卸载时取消在途请求。
 *
 * @param challenge - 当前挑战及过期时间；为 null 时不轮询
 * @param onConfirmed - 确认结果包含有效账号时调用一次
 * @returns 扫码状态与错误；出现错误后停止，重试需创建新挑战
 */
export function useMusicQrPolling(
	challenge: MusicChallenge | null,
	onConfirmed?: (account: MusicAccount) => void,
) {
	const qc = useQueryClient();
	const [qrState, setQrState] = useState<MusicQrState>("waiting");
	const [error, setError] = useState<string | null>(null);
	const onConfirmedRef = useRef(onConfirmed);
	onConfirmedRef.current = onConfirmed;
	const challengeId = challenge?.id;
	const expiresAt = challenge?.expires_at;

	useEffect(() => {
		setQrState("waiting");
		setError(null);
		if (!challengeId || !expiresAt) return;

		const remaining = Date.parse(expiresAt) - Date.now();
		if (!(remaining > 0)) {
			setQrState("expired");
			return;
		}

		const controller = new AbortController();
		let active = true;
		let timerId: number | undefined;
		const expiryTimerId = window.setTimeout(() => {
			active = false;
			controller.abort();
			window.clearTimeout(timerId);
			setQrState("expired");
		}, remaining);

		const poll = async () => {
			try {
				const check = await checkMusicLoginQR(challengeId, controller.signal);
				if (!active) return;
				if (check.state === "confirmed") {
					active = false;
					window.clearTimeout(expiryTimerId);
					if (check.account?.state !== "connected" || !check.account.profile) {
						setError("扫码确认未返回有效账号，请重新扫码");
						return;
					}
					setQrState("confirmed");
					qc.setQueryData(adminMusicKeys.account(), check.account);
					void qc.invalidateQueries({ queryKey: adminMusicKeys.library() });
					onConfirmedRef.current?.(check.account);
					return;
				}
				setQrState(check.state);
				if (check.state === "expired") {
					active = false;
					window.clearTimeout(expiryTimerId);
					return;
				}
				timerId = window.setTimeout(poll, 2000);
			} catch (cause) {
				if (!active) return;
				active = false;
				window.clearTimeout(expiryTimerId);
				setError(cause instanceof Error ? cause.message : "扫码状态查询失败，请重试");
			}
		};

		void poll();
		return () => {
			active = false;
			controller.abort();
			window.clearTimeout(timerId);
			window.clearTimeout(expiryTimerId);
		};
	}, [challengeId, expiresAt, qc]);

	return { qrState, error };
}
