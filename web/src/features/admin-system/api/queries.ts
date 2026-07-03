import { useQuery } from "@tanstack/react-query";
import * as api from "./client";
import { systemKeys } from "./keys";

/**
 * 快照轮询间隔（毫秒）。
 *
 * 快照每次调用都触发后端 collector.Collect() + PG/Redis 探活，是真正的实时数据，
 * 5s 才贴合实时仪表盘定位。
 */
const SNAPSHOT_INTERVAL_MS = 5_000;

/**
 * 历史轮询间隔（毫秒），与后端 system.sampler 的 30s 采样间隔对齐。
 *
 * 历史数据由 sampler 每 30s 写一个点进 Redis，前端轮询更快也拿不到更细粒度，
 * 故 30s 既是上限也是最优，避免无谓请求。
 */
const HISTORY_INTERVAL_MS = 30_000;

/** UseSystemMonitorOptions - 监控查询的公共控参 */
export interface UseSystemMonitorOptions {
    /**
     * 是否开启自动轮询。
     * - true：快照按 SNAPSHOT_INTERVAL_MS、历史按 HISTORY_INTERVAL_MS 各自节奏自动刷新；
     *   标签页隐藏时自停（refetchIntervalInBackground:false）。
     * - false：仅首次拉取，后续靠手动 invalidateQueries 触发。
     */
    polling: boolean;
}

/** useSystemSnapshot - 服务器实时快照 hook（按 polling 决定是否 5s 自动轮询） */
export const useSystemSnapshot = ({ polling }: UseSystemMonitorOptions) =>
    useQuery({
        queryKey: systemKeys.snapshot(),
        queryFn: () => api.getSystemSnapshot(),
        // 仓库首个 refetchInterval 用例：开启时每 5s 实时刷新
        refetchInterval: polling ? SNAPSHOT_INTERVAL_MS : 0,
        // 标签页隐藏时不轮询，避免无人盯盘时浪费后端采集 + 依赖探活开销
        refetchIntervalInBackground: false,
    });

/** useSystemHistory - 历史采样点 hook（按 polling 决定是否 30s 自动轮询） */
export const useSystemHistory = ({ polling }: UseSystemMonitorOptions) =>
    useQuery({
        queryKey: systemKeys.history(),
        queryFn: () => api.getSystemHistory(),
        refetchInterval: polling ? HISTORY_INTERVAL_MS : 0,
        refetchIntervalInBackground: false,
    });
