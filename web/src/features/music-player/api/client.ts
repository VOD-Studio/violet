import type { MusicPlaylist, MusicSong } from "@entities/music/model/types";
import type {
	MusicLyricDTO,
	MusicPlaybackDTO,
	MusicPlaybackStatusDTO,
} from "@features/music-player/model/types";
import { httpClient } from "@shared/api/http";
import { apiGet, apiGetPaged } from "@shared/api/request";
import type { PagedResponse, PageQuery } from "@shared/api/types";

const BASE = "/music";
const READ_OPTIONS = { "axios-retry": { retries: 0 } };

export const getPublicMusicPlaylists = (signal?: AbortSignal): Promise<MusicPlaylist[]> =>
	apiGet<MusicPlaylist[]>(`${BASE}/playlists`, { ...READ_OPTIONS, signal });

export const getPublicPlaybackStatus = (signal?: AbortSignal): Promise<MusicPlaybackStatusDTO> =>
	apiGet<MusicPlaybackStatusDTO>(`${BASE}/playback`, { ...READ_OPTIONS, signal });

export const getPublicPlaylistTracks = (
	id: string,
	query: PageQuery,
): Promise<PagedResponse<MusicSong>> =>
	apiGetPaged<MusicSong>(`${BASE}/playlists/${encodeURIComponent(id)}/tracks`, {
		...READ_OPTIONS,
		params: query,
	});

export const getPublicSong = (id: string): Promise<MusicSong> =>
	apiGet<MusicSong>(`${BASE}/songs/${encodeURIComponent(id)}`, READ_OPTIONS);

export const getPublicPlayback = (id: string, signal?: AbortSignal): Promise<MusicPlaybackDTO> =>
	apiGet<MusicPlaybackDTO>(`${BASE}/songs/${encodeURIComponent(id)}/url`, {
		...READ_OPTIONS,
		signal,
	});

export const getPublicLyric = (id: string): Promise<MusicLyricDTO> =>
	apiGet<MusicLyricDTO>(`${BASE}/songs/${encodeURIComponent(id)}/lyric`, READ_OPTIONS);

/**
 * 使用与业务请求相同的 API 基地址生成媒体资源地址，仅在客户端调用。
 *
 * @param id - 网易云歌曲 ID，作为单个路径段编码
 * @param resource - stream 返回按需重定向，lyric 返回歌词 JSON
 * @returns 绝对地址；stream 地址可持久保存，不包含临时 CDN 链接
 */
export function musicResourceUrl(id: string, resource: "stream" | "lyric"): string {
	const url = httpClient.getUri({ url: `${BASE}/songs/${encodeURIComponent(id)}/${resource}` });
	return new URL(url, window.location.origin).href;
}
