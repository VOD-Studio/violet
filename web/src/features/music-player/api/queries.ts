import { musicKeys } from "@entities/music/api/keys";
import {
	getPublicMusicPlaylists,
	getPublicPlayback,
	getPublicPlaybackStatus,
} from "@features/music-player/api/client";
import { useQuery } from "@tanstack/react-query";

export const usePublicMusicPlaylists = () =>
	useQuery({
		queryKey: musicKeys.playlists(),
		queryFn: ({ signal }) => getPublicMusicPlaylists(signal),
		retry: false,
	});

/**
 * 播放凭据模式；变化时消费方需重建队列权限。
 *
 * @remarks 只读本地存储的后端端点，不发上游请求；失败时按匿名处理。
 */
export const usePublicPlaybackStatus = () =>
	useQuery({
		queryKey: musicKeys.playback(),
		queryFn: ({ signal }) => getPublicPlaybackStatus(signal),
		retry: false,
		staleTime: 60_000,
	});

/**
 * 单曲解析结果，用于展示「仅试听」提示。
 *
 * @param id - 网易云歌曲 ID
 * @param enabled - 存在当前曲目时才查询
 *
 * @remarks 命中后端解析缓存时无上游请求；仅作展示，不驱动播放。
 */
export const usePublicPlaybackDetail = (id: string | null, enabled: boolean) =>
	useQuery({
		queryKey: [...musicKeys.all, "playback-detail", id],
		queryFn: ({ signal }) => getPublicPlayback(id as string, signal),
		enabled: enabled && id !== null,
		retry: false,
		staleTime: 5 * 60_000,
	});
