import { apiDelete, apiPatch, apiPost, apiPut } from "@shared/api/request";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
    AdminSiteSettings,
    CreateAnnouncement,
    UpdateAnnouncement,
    UpdateSettings,
} from "../model/types";
import { settingsKeys } from "./keys";

/**
 * useUpdateSettings - 更新站点设置 mutation
 *
 * 对接 PUT /admin/settings，部分更新字段，返回完整 AdminSiteSettings。
 * 成功后 invalidate 公开与管理员站点配置缓存。
 */
export const useUpdateSettings = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (body: UpdateSettings) => apiPut<AdminSiteSettings>("/admin/settings", body),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: settingsKeys.admin() });
            queryClient.invalidateQueries({ queryKey: settingsKeys.public() });
        },
    });
};

/**
 * useCreateAnnouncement - 创建公告 mutation
 *
 * 对接 POST /admin/announcements，后端返回 { id }。
 * 成功后 invalidate 公告列表与公开公告缓存。
 */
export const useCreateAnnouncement = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (body: CreateAnnouncement) =>
            apiPost<{ id: number }>("/admin/announcements", body),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: settingsKeys.adminAnnouncements(),
            });
            queryClient.invalidateQueries({
                queryKey: settingsKeys.announcements(),
            });
        },
    });
};

/**
 * useUpdateAnnouncement - 更新公告 mutation
 *
 * 对接 PATCH /admin/announcements/{id}，后端返回消息信封 data 为 null。
 * 成功后 invalidate 公告列表、详情与公开公告缓存。
 *
 * @param id 公告 ID
 */
export const useUpdateAnnouncement = (id: number) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (body: UpdateAnnouncement) =>
            apiPatch<null>(`/admin/announcements/${id}`, body),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: settingsKeys.adminAnnouncements(),
            });
            queryClient.invalidateQueries({
                queryKey: settingsKeys.adminAnnouncementDetail(id),
            });
            queryClient.invalidateQueries({
                queryKey: settingsKeys.announcements(),
            });
        },
    });
};

/**
 * useDeleteAnnouncement - 删除公告 mutation
 *
 * 对接 DELETE /admin/announcements/{id}，后端返回消息信封 data 为 null。
 *
 * @param id 公告 ID
 */
export const useDeleteAnnouncement = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => apiDelete<null>(`/admin/announcements/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: settingsKeys.adminAnnouncements(),
            });
            queryClient.invalidateQueries({
                queryKey: settingsKeys.announcements(),
            });
        },
    });
};
