import type { PageQuery } from "@/shared/api/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type {
	AddFeaturedPlaylistRequest,
	MusicAccount,
	MusicChallengeCheck,
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
 * 扫码登录状态自动轮询 Hook。
 *
 * @param challengeId 当前挑战 ID，为 null 时不轮询
 * @param onConfirmed 扫码并确认成功时的回调
 */
export function useMusicQrPolling(
	challengeId: string | null,
	onConfirmed?: (account: MusicAccount) => void,
) {
	const qc = useQueryClient();
	const [qrState, setQrState] = useState<MusicQrState>("waiting");
	const onConfirmedRef = useRef(onConfirmed);
	onConfirmedRef.current = onConfirmed;

	useEffect(() => {
		if (!challengeId) {
			setQrState("waiting");
			return;
		}

		let active = true;
		let timerId: NodeJS.Timeout | number | undefined;

		const poll = async () => {
			try {
				const check: MusicChallengeCheck = await checkMusicLoginQR(challengeId);
				if (!active) return;
				setQrState(check.state);

				if (check.state === "confirmed" && check.account) {
					qc.setQueryData(adminMusicKeys.account(), check.account);
					qc.invalidateQueries({ queryKey: adminMusicKeys.library() });
					onConfirmedRef.current?.(check.account);
					return;
				}

				if (check.state === "expired") {
					return;
				}

				// 未完成时隔 2 秒继续轮询
				timerId = setTimeout(poll, 2000);
			} catch {
				if (!active) return;
				// 上游异常时稍作退避重试
				timerId = setTimeout(poll, 3000);
			}
		};

		poll();

		return () => {
			active = false;
			clearTimeout(timerId);
		};
	}, [challengeId, qc]);

	return { qrState };
}
