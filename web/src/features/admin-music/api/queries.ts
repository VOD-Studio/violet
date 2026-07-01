import type { Playlist } from "@entities/music/model/types";
import { apiGet } from "@shared/api/request";
import { useQuery } from "@tanstack/react-query";
import { adminMusicKeys } from "./keys";

/**
 * fetchAllPlaylistsAdmin - 调后端 GET /admin/music/playlists 获取全部歌单
 *
 * 含未启用歌单。后端 ListAllPlaylists 直接序列化 PlaylistDTO 数组，未走分页封装。
 */
export const fetchAllPlaylistsAdmin = async (): Promise<Playlist[]> =>
    apiGet<Playlist[]>("/admin/music/playlists");

/** useAllPlaylistsAdmin - 后台全部歌单列表 hook */
export const useAllPlaylistsAdmin = () =>
    useQuery({
        queryKey: adminMusicKeys.adminList(),
        queryFn: fetchAllPlaylistsAdmin,
    });

/**
 * fetchPlaylistDetailAdmin - 调后端 GET /admin/music/playlists/{id} 获取歌单详情
 *
 * @param id 歌单 ID
 */
export const fetchPlaylistDetailAdmin = async (id: string): Promise<Playlist> =>
    apiGet<Playlist>(`/admin/music/playlists/${id}`);

/** usePlaylistDetailAdmin - 后台歌单详情 hook，传空串时不启用查询 */
export const usePlaylistDetailAdmin = (id: string) =>
    useQuery({
        queryKey: adminMusicKeys.adminDetail(id),
        queryFn: () => fetchPlaylistDetailAdmin(id),
        enabled: !!id,
    });
