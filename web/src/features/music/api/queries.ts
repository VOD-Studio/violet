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

/**
 * fetchMusicEmbed - 调后端 GET /music/embed 解析音乐链接
 *
 * @param query 含 url 查询参数
 * @returns 嵌入信息，字段为 PascalCase
 */
export const fetchMusicEmbed = async (query: MusicEmbedQuery): Promise<EmbedInfo> =>
    apiGet<EmbedInfo>("/music/embed", { params: query });

/** useMusicEmbed - 解析音乐嵌入信息 hook */
export const useMusicEmbed = (query: MusicEmbedQuery) =>
    useQuery({
        queryKey: musicKeys.embed(query.url),
        queryFn: () => fetchMusicEmbed(query),
        enabled: !!query.url,
    });

/** fetchPlaylistParse - GET /music/playlist 解析歌单链接 */
export const fetchPlaylistParse = async (query: MusicPlaylistQuery): Promise<PlaylistMeta> =>
    apiGet<PlaylistMeta>("/music/playlist", { params: query });

/** usePlaylistParse - 解析歌单链接 hook */
export const usePlaylistParse = (query: MusicPlaylistQuery) =>
    useQuery({
        queryKey: musicKeys.playlistParse(query.url),
        queryFn: () => fetchPlaylistParse(query),
        enabled: !!query.url,
    });

/** fetchSongDetail - GET /music/song 获取歌曲详情 */
export const fetchSongDetail = async (query: MusicSongQuery): Promise<Song> =>
    apiGet<Song>("/music/song", { params: query });

/** useSongDetail - 获取歌曲详情 hook */
export const useSongDetail = (query: MusicSongQuery) =>
    useQuery({
        queryKey: musicKeys.songDetail(query),
        queryFn: () => fetchSongDetail(query),
        enabled: !!query.id,
    });

/** fetchSongSearch - GET /music/search 搜索歌曲 */
export const fetchSongSearch = async (query: MusicSearchQuery): Promise<Song[]> =>
    apiGet<Song[]>("/music/search", { params: query });

/** useSongSearch - 搜索歌曲 hook */
export const useSongSearch = (query: MusicSearchQuery) =>
    useQuery({
        queryKey: musicKeys.search(query),
        queryFn: () => fetchSongSearch(query),
        enabled: !!query.keyword,
    });

/** fetchLyrics - GET /music/lyrics 获取 LRC 歌词纯文本 */
export const fetchLyrics = async (query: MusicSongQuery): Promise<string> =>
    apiGet<string>("/music/lyrics", { params: query });

/** useLyrics - 获取歌词 hook */
export const useLyrics = (query: MusicSongQuery) =>
    useQuery({
        queryKey: musicKeys.lyrics(query),
        queryFn: () => fetchLyrics(query),
        enabled: !!query.id,
    });

/** fetchSongMeta - GET /music/meta 获取歌曲元数据，合并封面与歌词 */
export const fetchSongMeta = async (query: MusicSongQuery): Promise<SongMeta> =>
    apiGet<SongMeta>("/music/meta", { params: query });

/** useSongMeta - 获取歌曲元数据 hook */
export const useSongMeta = (query: MusicSongQuery) =>
    useQuery({
        queryKey: musicKeys.songMeta(query),
        queryFn: () => fetchSongMeta(query),
        enabled: !!query.id,
    });

/** fetchActivePlaylists - GET /music/playlists/active 获取启用歌单 */
export const fetchActivePlaylists = async (): Promise<Playlist[]> =>
    apiGet<Playlist[]>("/music/playlists/active");

/** useActivePlaylists - 启用歌单列表 hook */
export const useActivePlaylists = () =>
    useQuery({
        queryKey: musicKeys.activePlaylists(),
        queryFn: fetchActivePlaylists,
    });

/** fetchMusicSettings - GET /music/settings 获取播放器设置 */
export const fetchMusicSettings = async (): Promise<MusicSettings> =>
    apiGet<MusicSettings>("/music/settings");

/** useMusicSettings - 播放器设置 hook */
export const useMusicSettings = () =>
    useQuery({
        queryKey: musicKeys.settings(),
        queryFn: fetchMusicSettings,
    });
