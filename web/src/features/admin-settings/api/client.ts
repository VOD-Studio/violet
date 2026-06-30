import { apiGet, apiPut } from "@shared/api/request";
import type { SiteSettingsDTO, UpdateSettingsRequest } from "../model/types";

const BASE = "/admin/settings";

/** getSettings - 调 GET /admin/settings 获取站点配置 */
export const getSettings = async (): Promise<SiteSettingsDTO> => apiGet<SiteSettingsDTO>(BASE);

/** updateSettings - 调 PUT /admin/settings 更新站点配置，返回更新后的全量配置 */
export const updateSettings = async (body: UpdateSettingsRequest): Promise<SiteSettingsDTO> =>
    apiPut<SiteSettingsDTO>(BASE, body);
