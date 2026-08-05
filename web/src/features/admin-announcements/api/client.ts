/**
 * admin-announcements API 客户端
 */
import { apiDelete, apiGet, apiPatch, apiPost } from "@/shared/api/request";
import type {
	AnnouncementDTO,
	CreateAnnouncementRequest,
	UpdateAnnouncementRequest,
} from "../model/types";

const BASE = "/admin/announcements";

/**
 * 获取所有公告列表
 *
 * GET /admin/announcements
 */
export const listAnnouncements = async (): Promise<AnnouncementDTO[]> =>
	apiGet<AnnouncementDTO[]>(BASE);

/**
 * 获取单个公告详情
 *
 * GET /admin/announcements/{id}
 */
export const getAnnouncement = async (id: number): Promise<AnnouncementDTO> =>
	apiGet<AnnouncementDTO>(`${BASE}/${id}`);

/**
 * 创建公告
 *
 * POST /admin/announcements
 */
export const createAnnouncement = async (
	body: CreateAnnouncementRequest,
): Promise<{ id: number }> => apiPost<{ id: number }>(BASE, body);

/**
 * 更新公告
 *
 * PATCH /admin/announcements/{id}
 */
export const updateAnnouncement = async (
	id: number,
	body: UpdateAnnouncementRequest,
): Promise<void> => apiPatch<void>(`${BASE}/${id}`, body);

/**
 * 删除公告
 *
 * DELETE /admin/announcements/{id}
 */
export const deleteAnnouncement = async (id: number): Promise<void> =>
	apiDelete<void>(`${BASE}/${id}`);
