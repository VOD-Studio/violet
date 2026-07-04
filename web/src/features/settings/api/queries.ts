import { apiGet } from "@shared/api/request";
import { useQuery } from "@tanstack/react-query";
import type { Announcement, SiteSettings } from "../model/types";
import { settingsKeys } from "./keys";

/**
 * fetchAnnouncement - 调 GET /api/v1/announcements/:id 拉取单个生效公告
 *
 * 供 article 形态详情页消费。
 */
export const fetchAnnouncement = async (id: string): Promise<Announcement> =>
    apiGet<Announcement>(`/announcements/${id}`);

/** useAnnouncement - 单个公告 hook(article 详情页) */
export const useAnnouncement = (id: string) =>
    useQuery({
        queryKey: [...settingsKeys.announcements(), id],
        queryFn: () => fetchAnnouncement(id),
        enabled: !!id,
    });

/**
 * fetchSettings - 调 GET /api/v1/settings 拉取公开站点配置
 *
 * @returns 站点配置，站名/描述/社交链接等
 */
export const fetchSettings = async (): Promise<SiteSettings> => apiGet<SiteSettings>("/settings");

/**
 * useSettings - 站点配置 hook
 *
 * staleTime 10 分钟，站点配置更新频率低。
 */
export const useSettings = () =>
    useQuery({
        queryKey: settingsKeys.public(),
        queryFn: fetchSettings,
        staleTime: 10 * 60 * 1000,
    });

/**
 * fetchAnnouncements - 调 GET /api/v1/announcements 拉取生效公告
 *
 * @returns 生效公告列表，排序由后端 sort_order ASC, created_at DESC 决定
 */
export const fetchAnnouncements = async (): Promise<Announcement[]> =>
    apiGet<Announcement[]>("/announcements");

/** useAnnouncements - 公告 hook */
export const useAnnouncements = () =>
    useQuery({
        queryKey: settingsKeys.announcements(),
        queryFn: fetchAnnouncements,
    });
