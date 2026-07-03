import { apiGet } from "@shared/api/request";
import { useQuery } from "@tanstack/react-query";

import type { HistoryResponse, Snapshot } from "../model/types";
import { systemKeys } from "./keys";

/** 服务器实时快照（5s 轮询，可被开关控制） */
export const useSystemSnapshot = (autoRefresh: boolean) =>
	useQuery({
		queryKey: systemKeys.snapshot(),
		queryFn: () => apiGet<Snapshot>("/admin/system/snapshot"),
		refetchInterval: autoRefresh ? 5000 : false,
		refetchIntervalInBackground: false,
	});

/** 历史趋势（30s 刷新） */
export const useSystemHistory = (autoRefresh: boolean) =>
	useQuery({
		queryKey: systemKeys.history(),
		queryFn: () => apiGet<HistoryResponse>("/admin/system/history"),
		refetchInterval: autoRefresh ? 30000 : false,
		refetchIntervalInBackground: false,
	});
