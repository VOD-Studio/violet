import { apiGet, apiPut } from "@shared/api/request";
import type { SiteSettingsDTO, UpdateSettingsRequest } from "../model/types";

const BASE = "/admin/settings";

/** getSettings - 调 GET /admin/settings 获取站点配置 */
export const getSettings = async (): Promise<SiteSettingsDTO> => apiGet<SiteSettingsDTO>(BASE);

/**
 * updateSettings - 调 PUT /admin/settings 更新站点配置，返回更新后的全量配置
 *
 * 入参为 Partial：后端按指针语义做部分更新（nil 字段不更新），
 * 调用方可只提交本次改动的字段（如设置子页各自只提交本页字段），未提交字段后端保持不变。
 */
export const updateSettings = async (
    body: Partial<UpdateSettingsRequest>,
): Promise<SiteSettingsDTO> => apiPut<SiteSettingsDTO>(BASE, body);
