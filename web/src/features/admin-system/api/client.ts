import { apiGet } from "@shared/api/request";
import type { SystemHistoryDTO, SystemSnapshotDTO } from "../model/types";

const BASE = "/admin/system";

/** getSystemSnapshot - 调 GET /admin/system/snapshot 获取服务器实时快照（含依赖探活） */
export const getSystemSnapshot = async (): Promise<SystemSnapshotDTO> =>
	apiGet<SystemSnapshotDTO>(`${BASE}/snapshot`);

/** getSystemHistory - 调 GET /admin/system/history 获取历史采样点（30s 间隔，最多 24h） */
export const getSystemHistory = async (): Promise<SystemHistoryDTO> =>
	apiGet<SystemHistoryDTO>(`${BASE}/history`);
