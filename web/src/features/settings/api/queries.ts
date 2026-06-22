import { httpClient } from "@shared/api/http";
import { useQuery } from "@tanstack/react-query";
import type { Announcement, SiteSettings } from "../model/types";
import { settingsKeys } from "./keys";

/**
 * fetchSettings - 调 GET /api/v1/settings 拉取公开站点配置
 *
 * @returns 站点配置（站名/描述/社交链接等）
 */
export const fetchSettings = async (): Promise<SiteSettings> => {
	const res = await httpClient.get<{ data: SiteSettings }>("/settings");
	return res.data.data;
};

/**
 * useSettings - 站点配置 hook
 *
 * staleTime 10 分钟（站点配置更新频率低，减少重复请求）。
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
 * @returns 生效公告列表（已按 pinned 排序的由前端 AnnouncementBar 处理）
 */
export const fetchAnnouncements = async (): Promise<Announcement[]> => {
	const res = await httpClient.get<{ data: Announcement[] }>("/announcements");
	return res.data.data;
};

/**
 * useAnnouncements - 公告 hook
 */
export const useAnnouncements = () =>
	useQuery({
		queryKey: settingsKeys.announcements(),
		queryFn: fetchAnnouncements,
	});
