import { httpClient } from "@shared/api/http";
import { apiGet } from "@shared/api/request";
import { useQuery } from "@tanstack/react-query";
import type {
	AdminAnnouncement,
	AdminSiteSettings,
	Announcement,
	SiteSettings,
} from "../model/types";
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

/**
 * fetchAdminSettings - 获取管理员站点设置（完整字段）
 *
 * 对接 GET /admin/settings，返回 AdminSiteSettings 含敏感字段。
 */
export const fetchAdminSettings = (): Promise<AdminSiteSettings> =>
	apiGet<AdminSiteSettings>("/admin/settings");

/**
 * useAdminSettings - 管理员站点设置 hook
 *
 * staleTime 10 分钟，与公开配置一致。
 */
export const useAdminSettings = () =>
	useQuery({
		queryKey: settingsKeys.admin(),
		queryFn: fetchAdminSettings,
		staleTime: 10 * 60 * 1000,
	});

/**
 * fetchAdminAnnouncements - 获取管理员公告列表（全部，不分页）
 *
 * 对接 GET /admin/announcements，后端返回扁平数组而非分页响应。
 */
export const fetchAdminAnnouncements = (): Promise<AdminAnnouncement[]> =>
	apiGet<AdminAnnouncement[]>("/admin/announcements");

/**
 * useAdminAnnouncements - 管理员公告列表 hook
 */
export const useAdminAnnouncements = () =>
	useQuery({
		queryKey: settingsKeys.adminAnnouncements(),
		queryFn: fetchAdminAnnouncements,
	});

/**
 * fetchAdminAnnouncement - 获取单个公告详情
 *
 * 对接 GET /admin/announcements/{id}。
 *
 * @param id 公告 ID
 */
export const fetchAdminAnnouncement = (
	id: number,
): Promise<AdminAnnouncement> =>
	apiGet<AdminAnnouncement>(`/admin/announcements/${id}`);

/**
 * useAdminAnnouncement - 管理员公告详情 hook
 *
 * @param id 公告 ID，为 null 时不查询
 */
export const useAdminAnnouncement = (id: number | null) =>
	useQuery({
		queryKey: settingsKeys.adminAnnouncementDetail(id ?? 0),
		queryFn: () => {
			if (id === null) {
				throw new Error("公告 ID 不能为空");
			}
			return fetchAdminAnnouncement(id);
		},
		enabled: id != null,
	});
