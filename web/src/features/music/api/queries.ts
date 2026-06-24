import { apiGet } from "@shared/api/request";
import { useQuery } from "@tanstack/react-query";
import type {
	EmbedInfo,
	MusicEmbedQuery,
	MusicPlaylistQuery,
	MusicSearchQuery,
	MusicSettings,
	MusicSongQuery,
	Playlist,
	PlaylistMeta,
	Song,
	SongMeta,
} from "../model/types";
import { musicKeys } from "./keys";

// ============================================================
// 公开音乐解析（前台播放器）
// ============================================================

/**
 * fetchMusicEmbed - 调后端 GET /music/embed 解析音乐链接
 *
 * @param query 含 url 查询参数
 * @returns 嵌入信息，字段为 PascalCase
 */
export const fetchMusicEmbed = async (query: MusicEmbedQuery): Promise<EmbedInfo> =>
	apiGet<EmbedInfo>("/music/embed", { params: query });

/**
 * useMusicEmbed - 解析音乐嵌入信息 hook
 *
 * @param query 含 url，url 为空时不启用查询
 */
export const useMusicEmbed = (query: MusicEmbedQuery) =>
	useQuery({
		queryKey: musicKeys.embed(query.url),
		queryFn: () => fetchMusicEmbed(query),
		enabled: !!query.url,
	});

/**
 * fetchPlaylistParse - 调后端 GET /music/playlist 解析歌单链接
 *
 * @param query 含 url 查询参数
 * @returns 歌单解析元数据，字段为 PascalCase
 */
export const fetchPlaylistParse = async (query: MusicPlaylistQuery): Promise<PlaylistMeta> =>
	apiGet<PlaylistMeta>("/music/playlist", { params: query });

/**
 * usePlaylistParse - 解析歌单链接 hook
 *
 * @param query 含 url，url 为空时不启用查询
 */
export const usePlaylistParse = (query: MusicPlaylistQuery) =>
	useQuery({
		queryKey: musicKeys.playlistParse(query.url),
		queryFn: () => fetchPlaylistParse(query),
		enabled: !!query.url,
	});

/**
 * fetchSongDetail - 调后端 GET /music/song 获取歌曲详情
 *
 * @param query 含 id 与可选 platform
 * @returns 歌曲详情
 */
export const fetchSongDetail = async (query: MusicSongQuery): Promise<Song> =>
	apiGet<Song>("/music/song", { params: query });

/**
 * useSongDetail - 获取歌曲详情 hook
 *
 * @param query 含 id，id 为空时不启用查询
 */
export const useSongDetail = (query: MusicSongQuery) =>
	useQuery({
		queryKey: musicKeys.songDetail(query),
		queryFn: () => fetchSongDetail(query),
		enabled: !!query.id,
	});

/**
 * fetchSongSearch - 调后端 GET /music/search 搜索歌曲
 *
 * @param query 含 keyword 与可选 limit
 * @returns 歌曲列表
 */
export const fetchSongSearch = async (query: MusicSearchQuery): Promise<Song[]> =>
	apiGet<Song[]>("/music/search", { params: query });

/**
 * useSongSearch - 搜索歌曲 hook
 *
 * @param query 含 keyword，keyword 为空时不启用查询
 */
export const useSongSearch = (query: MusicSearchQuery) =>
	useQuery({
		queryKey: musicKeys.search(query),
		queryFn: () => fetchSongSearch(query),
		enabled: !!query.keyword,
	});

/**
 * fetchLyrics - 调后端 GET /music/lyrics 获取歌词
 *
 * 后端返回 LRC 歌词纯文本，envelope data 字段即字符串。
 *
 * @param query 含 id 与可选 platform
 * @returns LRC 歌词文本
 */
export const fetchLyrics = async (query: MusicSongQuery): Promise<string> =>
	apiGet<string>("/music/lyrics", { params: query });

/**
 * useLyrics - 获取歌词 hook
 *
 * @param query 含 id，id 为空时不启用查询
 */
export const useLyrics = (query: MusicSongQuery) =>
	useQuery({
		queryKey: musicKeys.lyrics(query),
		queryFn: () => fetchLyrics(query),
		enabled: !!query.id,
	});

/**
 * fetchSongMeta - 调后端 GET /music/meta 获取歌曲元数据
 *
 * 合并封面与歌词，返回字段为 PascalCase。
 *
 * @param query 含 id 与可选 platform
 * @returns 歌曲元数据，含 Cover 与 Lyrics
 */
export const fetchSongMeta = async (query: MusicSongQuery): Promise<SongMeta> =>
	apiGet<SongMeta>("/music/meta", { params: query });

/**
 * useSongMeta - 获取歌曲元数据 hook
 *
 * @param query 含 id，id 为空时不启用查询
 */
export const useSongMeta = (query: MusicSongQuery) =>
	useQuery({
		queryKey: musicKeys.songMeta(query),
		queryFn: () => fetchSongMeta(query),
		enabled: !!query.id,
	});

/**
 * fetchActivePlaylists - 调后端 GET /music/playlists/active 获取启用歌单
 *
 * 公开接口，后端 GetActivePlaylists handler 直接序列化 PlaylistDTO 数组，
 * 未走分页封装，故用 apiGet 取数组。
 *
 * @returns 启用歌单列表
 */
export const fetchActivePlaylists = async (): Promise<Playlist[]> =>
	apiGet<Playlist[]>("/music/playlists/active");

/**
 * useActivePlaylists - 启用歌单列表 hook
 *
 * 公开数据，缓存 key 固定无参数。
 */
export const useActivePlaylists = () =>
	useQuery({
		queryKey: musicKeys.activePlaylists(),
		queryFn: fetchActivePlaylists,
	});

/**
 * fetchMusicSettings - 调后端 GET /music/settings 获取播放器设置
 *
 * @returns 播放器设置，当前仅含 player_version
 */
export const fetchMusicSettings = async (): Promise<MusicSettings> =>
	apiGet<MusicSettings>("/music/settings");

/**
 * useMusicSettings - 播放器设置 hook
 */
export const useMusicSettings = () =>
	useQuery({
		queryKey: musicKeys.settings(),
		queryFn: fetchMusicSettings,
	});

// ============================================================
// 后台歌单管理（admin）
// ============================================================

/**
 * fetchAllPlaylistsAdmin - 调后端 GET /admin/music/playlists 获取全部歌单
 *
 * 后台接口，含未启用歌单。后端 ListAllPlaylists handler 直接序列化
 * PlaylistDTO 数组，未走分页封装，故用 apiGet 取数组。
 *
 * @returns 全部歌单列表含未启用
 */
export const fetchAllPlaylistsAdmin = async (): Promise<Playlist[]> =>
	apiGet<Playlist[]>("/admin/music/playlists");

/**
 * useAllPlaylistsAdmin - 后台全部歌单列表 hook
 *
 * 管理员身份由 httpClient 自动携带 cookie。写操作后需手动 invalidate
 * musicKeys.adminList()。
 */
export const useAllPlaylistsAdmin = () =>
	useQuery({
		queryKey: musicKeys.adminList(),
		queryFn: fetchAllPlaylistsAdmin,
	});

/**
 * fetchPlaylistDetailAdmin - 调后端 GET /admin/music/playlists/{id} 获取歌单详情
 *
 * @param id 歌单 ID
 * @returns 歌单详情含歌曲列表
 */
export const fetchPlaylistDetailAdmin = async (id: string): Promise<Playlist> =>
	apiGet<Playlist>(`/admin/music/playlists/${id}`);

/**
 * usePlaylistDetailAdmin - 后台歌单详情 hook
 *
 * @param id 歌单 ID，传空串时不启用查询
 */
export const usePlaylistDetailAdmin = (id: string) =>
	useQuery({
		queryKey: musicKeys.adminDetail(id),
		queryFn: () => fetchPlaylistDetailAdmin(id),
		enabled: !!id,
	});
