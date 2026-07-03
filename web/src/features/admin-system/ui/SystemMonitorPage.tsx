import { PageShell } from "@features/admin-layout/ui/PageShell";
import { Button } from "@shared/ui/base/button";
import { Skeleton } from "@shared/ui/base/skeleton";
import { Switch } from "@shared/ui/base/switch";
import { Segmented, type SegmentedItem } from "@shared/ui/segmented";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Activity, Pause, Play, RefreshCw } from "lucide-react";
import { useState } from "react";
import { systemKeys } from "../api/keys";
import { useSystemHistory, useSystemSnapshot } from "../api/queries";
import { ConsoleView } from "./ConsoleView";
import { StreamView } from "./StreamView";
import { DiskTable } from "./sections/DiskTable";
import { HostAndRuntimePanel } from "./sections/HostAndRuntimePanel";

/** 监控页视图类型 */
type MonitorView = "stream" | "console";

/** viewSegments - Segmented 视图切换配置（声明在此处，避免每次渲染重建） */
const VIEW_SEGMENTS: SegmentedItem<MonitorView>[] = [
    { value: "stream", label: "时序带" },
    { value: "console", label: "控制台" },
];

/** SystemMonitorPage - 服务监控页面容器
 *
 * 顶栏控件：视图切换（Segmented）+ 自动轮询开关 + 手动刷新按钮 + 上次更新时间。
 * 下方按视图渲染 StreamView / ConsoleView，并在底部追加磁盘表与主机/运行时面板。
 * 默认进入「时序带 + 开启轮询」，视图与轮询偏好均不持久化（监控页每次进入都重置）。
 */
export function SystemMonitorPage() {
    const [view, setView] = useState<MonitorView>("stream");
    const [polling, setPolling] = useState(true);
    const qc = useQueryClient();

    const snapshotQ = useSystemSnapshot({ polling });
    const historyQ = useSystemHistory({ polling });

    const handleManualRefresh = () => {
        // polling 关闭时由按钮触发；开启时按钮也能立即强制刷新一次
        void qc.invalidateQueries({ queryKey: systemKeys.all });
    };

    const isLoading = snapshotQ.isLoading || historyQ.isLoading;
    const error = snapshotQ.error ?? historyQ.error;

    return (
        <PageShell
            title="系统监控"
            description="服务器实时资源、依赖状态与历史趋势"
            action={
                <div className="flex items-center gap-3">
                    <Segmented value={view} onValueChange={setView} segments={VIEW_SEGMENTS} />
                    <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                        <Switch checked={polling} onCheckedChange={setPolling} size="sm" />
                        {polling ? (
                            <span className="flex items-center gap-1">
                                <Play className="size-3" />
                                轮询中
                            </span>
                        ) : (
                            <span className="flex items-center gap-1">
                                <Pause className="size-3" />
                                已暂停
                            </span>
                        )}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleManualRefresh}
                        disabled={isLoading}
                    >
                        <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
                        刷新
                    </Button>
                </div>
            }
        >
            {/* 上次更新时间 */}
            {snapshotQ.data && (
                <p className="text-muted-foreground mb-4 text-xs">
                    上次更新：{format(new Date(snapshotQ.data.timestamp), "yyyy-MM-dd HH:mm:ss")}
                </p>
            )}

            {error ? (
                <ErrorBlock message={error.message} onRetry={handleManualRefresh} />
            ) : isLoading ? (
                <LoadingBlock />
            ) : snapshotQ.data && historyQ.data ? (
                <div className="space-y-8">
                    {view === "stream" ? (
                        <StreamView snapshot={snapshotQ.data} history={historyQ.data} />
                    ) : (
                        <ConsoleView snapshot={snapshotQ.data} history={historyQ.data} />
                    )}

                    {/* 两个视图共用的明细区块 */}
                    <section className="space-y-3">
                        <SectionTitle icon={<Activity className="size-3.5" />}>磁盘</SectionTitle>
                        <DiskTable disks={snapshotQ.data.disk} />
                    </section>
                    <section className="space-y-3">
                        <SectionTitle icon={<Activity className="size-3.5" />}>
                            主机与运行时
                        </SectionTitle>
                        <HostAndRuntimePanel
                            host={snapshotQ.data.host}
                            runtime={snapshotQ.data.runtime}
                        />
                    </section>
                </div>
            ) : (
                <ErrorBlock message="暂无监控数据" onRetry={handleManualRefresh} />
            )}
        </PageShell>
    );
}

/** SectionTitle - 区块小标题（图标 + 文字） */
function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <h3 className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
            {icon}
            {children}
        </h3>
    );
}

/** LoadingBlock - 加载骨架 */
function LoadingBlock() {
    return (
        <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
            </div>
        </div>
    );
}

/** ErrorBlock - 错误展示 + 重试 */
function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
    return (
        <div className="text-muted-foreground flex flex-col items-center gap-3 py-12">
            <p>加载监控数据失败：{message}</p>
            <Button variant="outline" size="sm" onClick={onRetry}>
                <RefreshCw className="size-3.5" />
                重试
            </Button>
        </div>
    );
}
