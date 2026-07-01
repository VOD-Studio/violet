import type { Playlist } from "@entities/music/model/types";
import { apiDelete, apiPatch, apiPost } from "@shared/api/request";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
    AddSongRequest,
    CreateCustomPlaylistRequest,
    ImportPlaylistRequest,
    SetPlaylistActiveRequest,
    UpdatePlayerSettingsRequest,
    UpdatePlaylistRequest,
    UpdateSongRequest,
} from "../model/types";
import { adminMusicKeys } from "./keys";

/** useImportPlaylist - 导入歌单，POST /admin/music/playlists */
export const useImportPlaylist = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: ImportPlaylistRequest) =>
            apiPost<Playlist>("/admin/music/playlists", body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: adminMusicKeys.adminList() });
        },
    });
};

/** useCreateCustomPlaylist - 创建自定义歌单，POST /admin/music/playlists/custom */
export const useCreateCustomPlaylist = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: CreateCustomPlaylistRequest) =>
            apiPost<Playlist>("/admin/music/playlists/custom", body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: adminMusicKeys.adminList() });
        },
    });
};

/** useUpdatePlaylist - 更新歌单，PATCH /admin/music/playlists/{id} */
export const useUpdatePlaylist = (id: string) => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: UpdatePlaylistRequest) =>
            apiPatch<null>(`/admin/music/playlists/${id}`, body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: adminMusicKeys.adminList() });
            qc.invalidateQueries({ queryKey: adminMusicKeys.adminDetail(id) });
        },
    });
};

/** useDeletePlaylist - 删除歌单，DELETE /admin/music/playlists/{id} */
export const useDeletePlaylist = (id: string) => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () => apiDelete<null>(`/admin/music/playlists/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: adminMusicKeys.adminList() });
        },
    });
};

/** useSetPlaylistActive - 启用/禁用歌单，PATCH /admin/music/playlists/{id}/active */
export const useSetPlaylistActive = (id: string) => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: SetPlaylistActiveRequest) =>
            apiPatch<null>(`/admin/music/playlists/${id}/active`, body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: adminMusicKeys.adminList() });
            qc.invalidateQueries({ queryKey: adminMusicKeys.adminDetail(id) });
        },
    });
};

/** useRefreshPlaylist - 刷新歌单歌曲，POST /admin/music/playlists/{id}/refresh */
export const useRefreshPlaylist = (id: string) => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () => apiPost<Playlist>(`/admin/music/playlists/${id}/refresh`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: adminMusicKeys.adminList() });
            qc.invalidateQueries({ queryKey: adminMusicKeys.adminDetail(id) });
        },
    });
};

/** useAddSongToPlaylist - 添加歌曲到歌单，POST /admin/music/playlists/{id}/songs */
export const useAddSongToPlaylist = (id: string) => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: AddSongRequest) =>
            apiPost<null>(`/admin/music/playlists/${id}/songs`, body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: adminMusicKeys.adminList() });
            qc.invalidateQueries({ queryKey: adminMusicKeys.adminDetail(id) });
        },
    });
};

/** useRemoveSongFromPlaylist - 从歌单移除歌曲，DELETE /admin/music/playlists/{id}/songs/{index} */
export const useRemoveSongFromPlaylist = (id: string, index: number) => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () => apiDelete<null>(`/admin/music/playlists/${id}/songs/${index}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: adminMusicKeys.adminList() });
            qc.invalidateQueries({ queryKey: adminMusicKeys.adminDetail(id) });
        },
    });
};

/** useUpdateSongInPlaylist - 更新歌单内歌曲，PATCH /admin/music/playlists/{id}/songs/{index} */
export const useUpdateSongInPlaylist = (id: string, index: number) => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: UpdateSongRequest) =>
            apiPatch<null>(`/admin/music/playlists/${id}/songs/${index}`, body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: adminMusicKeys.adminList() });
            qc.invalidateQueries({ queryKey: adminMusicKeys.adminDetail(id) });
        },
    });
};

/** useUpdatePlayerSettings - 更新播放器设置，PATCH /admin/music/settings */
export const useUpdatePlayerSettings = () =>
    useMutation({
        mutationFn: (body: UpdatePlayerSettingsRequest) =>
            apiPatch<null>("/admin/music/settings", body),
    });
