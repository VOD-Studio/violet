import { Activity, Cpu, HardDrive, MemoryStick, RefreshCw } from "lucide-react";
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/shared/ui/base/button";
import { Switch } from "@/shared/ui/base/switch";
import { PageShell } from "@features/admin-layout/ui/PageShell";
import { useSystemHistory, useSystemSnapshot } from "@features/admin-system/api/queries";
import { fmtBytes, fmtUptime } from "@features/admin-system/model/format";
import { DependencyPanel } from "@features/admin-system/ui/DependencyPanel";
import { HistoryCharts } from "@features/admin-system/ui/HistoryCharts";
import { MetricCard } from "@features/admin-system/ui/MetricCard";
import { NetworkPanel } from "@features/admin-system/ui/NetworkPanel";
import { RuntimePanel } from "@features/admin-system/ui/RuntimePanel";

export const Route = createFileRoute("/admin/system")({ component: SystemMonitorPage });

function SystemMonitorPage() {
    const [autoRefresh, setAutoRefresh] = useState(true);
    const snapshot = useSystemSnapshot(autoRefresh);
    const history = useSystemHistory(autoRefresh);
    const snap = snapshot.data;
    const rootDisk = snap?.disk.find((d) => d.path === "/") ?? snap?.disk[0];

    return (
        <PageShell
            title="服务器监控"
            description="服务器硬件、应用运行时与依赖状态的实时监控"
            action={
                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm">
                        <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
                        <span className="text-muted-foreground">自动刷新</span>
                        {autoRefresh && (
                            <span className="bg-chart-2 size-2 animate-pulse rounded-full" />
                        )}
                    </label>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            snapshot.refetch();
                            history.refetch();
                        }}
                    >
                        <RefreshCw className="size-4" />
                        刷新
                    </Button>
                </div>
            }
        >
            <div className="space-y-6">
                {/* 实时指标卡 */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <MetricCard
                        title="CPU"
                        percent={snap?.cpu.usagePercent ?? 0}
                        subtitle={snap ? `${snap.cpu.cores} 核 ${snap.cpu.modelName}` : undefined}
                        icon={<Cpu className="size-5" />}
                        isLoading={snapshot.isLoading}
                        delay={0}
                    />
                    <MetricCard
                        title="内存"
                        percent={snap?.memory.usedPercent ?? 0}
                        subtitle={
                            snap
                                ? `${fmtBytes(snap.memory.usedBytes)} / ${fmtBytes(snap.memory.totalBytes)}`
                                : undefined
                        }
                        icon={<MemoryStick className="size-5" />}
                        isLoading={snapshot.isLoading}
                        delay={80}
                    />
                    <MetricCard
                        title="磁盘"
                        percent={rootDisk?.usedPercent ?? 0}
                        subtitle={
                            rootDisk
                                ? `${fmtBytes(rootDisk.usedBytes)} / ${fmtBytes(rootDisk.totalBytes)}`
                                : undefined
                        }
                        icon={<HardDrive className="size-5" />}
                        isLoading={snapshot.isLoading}
                        delay={160}
                    />
                    <MetricCard
                        title="运行时长"
                        percent={Math.min(
                            ((snap?.runtime.uptimeSeconds ?? 0) / (86400 * 30)) * 100,
                            100,
                        )}
                        subtitle={snap ? fmtUptime(snap.runtime.uptimeSeconds) : undefined}
                        icon={<Activity className="size-5" />}
                        isLoading={snapshot.isLoading}
                        delay={240}
                    />
                </div>

                {/* 历史趋势图 */}
                <HistoryCharts data={history.data} isLoading={history.isLoading} />

                {/* 详情面板 */}
                <div className="grid gap-4 lg:grid-cols-2">
                    <RuntimePanel data={snap} />
                    <div className="space-y-4">
                        <DependencyPanel data={snap} />
                        <NetworkPanel data={snap} />
                    </div>
                </div>
            </div>
        </PageShell>
    );
}
