import { apiDelete, apiPatch, apiPost } from "@shared/api/request";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
	AddSongRequest,
	CreateCustomPlaylistRequest,
	ImportPlaylistRequest,
	Playlist,
	SetPlaylistActiveRequest,
	UpdatePlayerSettingsRequest,
	UpdatePlaylistRequest,
	UpdateSongRequest,
} from "../model/types";
import { musicKeys } from "./keys";

// ============================================================
// 后台歌单管理写操作
// ============================================================

/**
 * useImportPlaylist - 导入歌单
 *
 * 调后端 POST /admin/music/playlists，解析第三方歌单链接后创建。
 * 失效后台列表与公开启用歌单列表，公开侧可能因新增启用歌单而变化。
 */
export const useImportPlaylist = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: ImportPlaylistRequest) =>
			apiPost<Playlist>("/admin/music/playlists", body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: musicKeys.adminList() });
			qc.invalidateQueries({ queryKey: musicKeys.activePlaylists() });
		},
	});
};

/**
 * useCreateCustomPlaylist - 创建自定义歌单
 *
 * 调后端 POST /admin/music/playlists/custom，创建 platform 为 custom 的空歌单。
 * 失效后台列表与公开启用列表，新建默认启用故公开侧需同步。
 */
export const useCreateCustomPlaylist = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: CreateCustomPlaylistRequest) =>
			apiPost<Playlist>("/admin/music/playlists/custom", body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: musicKeys.adminList() });
			qc.invalidateQueries({ queryKey: musicKeys.activePlaylists() });
		},
	});
};

/**
 * useUpdatePlaylist - 更新歌单
 *
 * 调后端 PATCH /admin/music/playlists/{id}，部分更新标题与启用状态。
 * 失效后台列表、后台该歌单详情、公开启用列表，启用状态变化影响公开侧。
 *
 * @param id 歌单 ID
 */
export const useUpdatePlaylist = (id: string) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: UpdatePlaylistRequest) =>
			apiPatch<null>(`/admin/music/playlists/${id}`, body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: musicKeys.adminList() });
			qc.invalidateQueries({ queryKey: musicKeys.adminDetail(id) });
			qc.invalidateQueries({ queryKey: musicKeys.activePlaylists() });
		},
	});
};

/**
 * useDeletePlaylist - 删除歌单
 *
 * 调后端 DELETE /admin/music/playlists/{id}。
 * 失效后台列表与公开启用列表，公开侧需移除已删歌单。
 *
 * @param id 歌单 ID
 */
export const useDeletePlaylist = (id: string) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: () => apiDelete<null>(`/admin/music/playlists/${id}`),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: musicKeys.adminList() });
			qc.invalidateQueries({ queryKey: musicKeys.activePlaylists() });
		},
	});
};

/**
 * useSetPlaylistActive - 启用/禁用歌单
 *
 * 调后端 PATCH /admin/music/playlists/{id}/active。
 * 失效后台列表、详情与公开启用列表，公开侧随启用状态增减项。
 *
 * @param id 歌单 ID
 */
export const useSetPlaylistActive = (id: string) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: SetPlaylistActiveRequest) =>
			apiPatch<null>(`/admin/music/playlists/${id}/active`, body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: musicKeys.adminList() });
			qc.invalidateQueries({ queryKey: musicKeys.adminDetail(id) });
			qc.invalidateQueries({ queryKey: musicKeys.activePlaylists() });
		},
	});
};

/**
 * useRefreshPlaylist - 刷新歌单歌曲
 *
 * 调后端 POST /admin/music/playlists/{id}/refresh，重新从第三方拉取歌曲。
 * 返回刷新后的歌单，失效后台列表、详情与公开列表，歌曲列表可能整体变化。
 *
 * @param id 歌单 ID
 */
export const useRefreshPlaylist = (id: string) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: () => apiPost<Playlist>(`/admin/music/playlists/${id}/refresh`),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: musicKeys.adminList() });
			qc.invalidateQueries({ queryKey: musicKeys.adminDetail(id) });
			qc.invalidateQueries({ queryKey: musicKeys.activePlaylists() });
		},
	});
};

/**
 * useAddSongToPlaylist - 添加歌曲到歌单
 *
 * 调后端 POST /admin/music/playlists/{id}/songs，向歌单末尾追加歌曲。
 * 失效该歌单详情与后台列表，song_count 随之变化故列表也需刷新。
 * 公开列表的歌曲字段同样变化，一并失效。
 *
 * @param id 歌单 ID
 */
export const useAddSongToPlaylist = (id: string) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: AddSongRequest) =>
			apiPost<null>(`/admin/music/playlists/${id}/songs`, body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: musicKeys.adminList() });
			qc.invalidateQueries({ queryKey: musicKeys.adminDetail(id) });
			qc.invalidateQueries({ queryKey: musicKeys.activePlaylists() });
		},
	});
};

/**
 * useRemoveSongFromPlaylist - 从歌单移除歌曲
 *
 * 调后端 DELETE /admin/music/playlists/{id}/songs/{index}。
 * 失效该歌单详情、后台列表与公开列表，移除后 song_count 与歌曲列表同步变化。
 *
 * @param id 歌单 ID
 * @param index 歌曲在歌单内的索引
 */
export const useRemoveSongFromPlaylist = (id: string, index: number) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: () =>
			apiDelete<null>(`/admin/music/playlists/${id}/songs/${index}`),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: musicKeys.adminList() });
			qc.invalidateQueries({ queryKey: musicKeys.adminDetail(id) });
			qc.invalidateQueries({ queryKey: musicKeys.activePlaylists() });
		},
	});
};

/**
 * useUpdateSongInPlaylist - 更新歌单内歌曲
 *
 * 调后端 PATCH /admin/music/playlists/{id}/songs/{index}。
 * 失效该歌单详情、后台列表与公开列表。
 *
 * @param id 歌单 ID
 * @param index 歌曲在歌单内的索引
 */
export const useUpdateSongInPlaylist = (id: string, index: number) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: UpdateSongRequest) =>
			apiPatch<null>(`/admin/music/playlists/${id}/songs/${index}`, body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: musicKeys.adminList() });
			qc.invalidateQueries({ queryKey: musicKeys.adminDetail(id) });
			qc.invalidateQueries({ queryKey: musicKeys.activePlaylists() });
		},
	});
};

/**
 * useUpdatePlayerSettings - 更新播放器设置
 *
 * 调后端 PATCH /admin/music/settings，更新播放器版本号。
 * 失效公开设置缓存，公开侧下次拉取取新版本。
 */
export const useUpdatePlayerSettings = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: UpdatePlayerSettingsRequest) =>
			apiPatch<null>("/admin/music/settings", body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: musicKeys.settings() });
		},
	});
};
