import { useQuery } from "@tanstack/react-query";
import * as api from "./client";
import { systemKeys } from "./keys";

/** 轮询间隔（毫秒），与后端 system.sampler 的 30s 采样间隔对齐 */
const POLL_INTERVAL_MS = 30_000;

/** UseSystemMonitorOptions - 监控查询的公共控参 */
export interface UseSystemMonitorOptions {
    /**
     * 是否开启自动轮询。
     * - true：按 POLL_INTERVAL_MS 自动刷新，标签页隐藏时自停（refetchIntervalInBackground:false）。
     * - false：仅首次拉取，后续靠手动 invalidateQueries 触发。
     */
    polling: boolean;
}

/** useSystemSnapshot - 服务器实时快照 hook（按 polling 决定是否自动轮询） */
export const useSystemSnapshot = ({ polling }: UseSystemMonitorOptions) =>
    useQuery({
        queryKey: systemKeys.snapshot(),
        queryFn: () => api.getSystemSnapshot(),
        // 仓库首个 refetchInterval 用例：开启时每 30s 对齐后端 sampler 自动刷新
        refetchInterval: polling ? POLL_INTERVAL_MS : 0,
        // 标签页隐藏时不轮询，避免无人盯盘时浪费后端采集 + 依赖探活开销
        refetchIntervalInBackground: false,
    });

/** useSystemHistory - 历史采样点 hook（轮询策略与快照一致） */
export const useSystemHistory = ({ polling }: UseSystemMonitorOptions) =>
    useQuery({
        queryKey: systemKeys.history(),
        queryFn: () => api.getSystemHistory(),
        refetchInterval: polling ? POLL_INTERVAL_MS : 0,
        refetchIntervalInBackground: false,
    });
