import { apiGet, apiGetPaged } from "@shared/api/request";
import type { PagedResponse } from "@shared/api/types";
import { useQuery } from "@tanstack/react-query";
import type {
    InstantCheckQuery,
    InstantCheckResult,
    MediaFile,
    MediaListQuery,
    UploadStatus,
} from "../model/types";
import { adminFileKeys, mediaKeys } from "./keys";

/**
 * fetchMedia - 调后端 GET /media/{id} 拉取媒体详情，公开接口
 *
 * @param id 媒体 ID
 * @returns 媒体文件读模型
 */
export const fetchMedia = async (id: string): Promise<MediaFile> =>
    apiGet<MediaFile>(`/media/${id}`);

/**
 * useMedia - 媒体详情 hook，公开接口无需鉴权
 *
 * @param id 媒体 ID
 */
export const useMedia = (id: string) =>
    useQuery({
        queryKey: mediaKeys.detail(id),
        queryFn: () => fetchMedia(id),
        enabled: !!id,
    });

/**
 * fetchMediaList - 调后端 GET /media 拉取当前用户媒体列表
 *
 * 需鉴权，httpClient 自动携带 cookie。purpose 为用途筛选。
 *
 * @param query 分页与用途筛选
 * @returns 解包后的列表与分页元数据
 */
export const fetchMediaList = async (
    query: MediaListQuery = {},
): Promise<PagedResponse<MediaFile>> => {
    const { page, limit, purpose } = query;
    return apiGetPaged<MediaFile>("/media", {
        params: { page, limit, purpose },
    });
};

/**
 * useMediaList - 当前用户媒体列表 hook
 *
 * @param query 分页与用途筛选
 */
export const useMediaList = (query: MediaListQuery = {}) =>
    useQuery({
        queryKey: mediaKeys.list(query),
        queryFn: () => fetchMediaList(query),
    });

/**
 * fetchUploadStatus - 调后端 GET /upload/{uploadId}/status 查询分片上传状态
 *
 * 用于断点续传场景，返回已上传分片索引列表。
 *
 * @param uploadId 上传会话 ID
 */
export const fetchUploadStatus = async (uploadId: string): Promise<UploadStatus> =>
    apiGet<UploadStatus>(`/upload/${uploadId}/status`);

/**
 * useUploadStatus - 上传状态查询 hook
 *
 * 默认 enabled 随 uploadId 是否存在切换，避免空字符串误请求。
 *
 * @param uploadId 上传会话 ID
 */
export const useUploadStatus = (uploadId: string) =>
    useQuery({
        queryKey: mediaKeys.uploadStatus(uploadId),
        queryFn: () => fetchUploadStatus(uploadId),
        enabled: !!uploadId,
    });

// ============================================================
// admin 文件管理
// ============================================================

/**
 * fetchAdminFiles - 调后端 GET /admin/files 拉取文件列表
 *
 * 需管理员身份，与 /media 复用同一 handler，purpose 为用途筛选。
 *
 * @param query 分页与用途筛选
 */
export const fetchAdminFiles = async (
    query: MediaListQuery = {},
): Promise<PagedResponse<MediaFile>> => {
    const { page, limit, purpose } = query;
    return apiGetPaged<MediaFile>("/admin/files", {
        params: { page, limit, purpose },
    });
};

/**
 * useAdminFiles - admin 文件列表 hook
 *
 * @param query 分页与用途筛选
 */
export const useAdminFiles = (query: MediaListQuery = {}) =>
    useQuery({
        queryKey: adminFileKeys.list(query),
        queryFn: () => fetchAdminFiles(query),
    });

/**
 * checkInstantUpload - 调后端 GET /admin/files/instant 检查秒传
 *
 * 需管理员身份。hash 命中时返回已存在文件，否则 exists 为 false。
 *
 * @param query 秒传检查参数
 */
export const checkInstantUpload = async (query: InstantCheckQuery): Promise<InstantCheckResult> =>
    apiGet<InstantCheckResult>("/admin/files/instant", {
        params: { hash: query.hash },
    });

/**
 * useInstantCheck - 秒传检查 hook
 *
 * @param hash 文件哈希，空字符串时不发起请求
 */
export const useInstantCheck = (hash: string) =>
    useQuery({
        queryKey: adminFileKeys.instantCheck(hash),
        queryFn: () => checkInstantUpload({ hash }),
        enabled: !!hash,
    });
