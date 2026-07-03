import { fmtBytes, fmtNsToMs, fmtUptime } from "../model/format";
import type { Snapshot } from "../model/types";

/** RuntimePanel - Go 运行时详情面板 */
export function RuntimePanel({ data }: { data?: Snapshot }) {
    if (!data) return null;
    const { runtime } = data;
    const items = [
        { label: "Go 版本", value: runtime.goVersion },
        { label: "Goroutines", value: runtime.goroutines.toString() },
        { label: "OS 线程", value: runtime.numThreads.toString() },
        { label: "CGO 调用", value: runtime.numCgoCall.toString() },
        { label: "系统进程数", value: runtime.processCount.toString() },
        { label: "运行时长", value: fmtUptime(runtime.uptimeSeconds) },
        { label: "堆分配", value: fmtBytes(runtime.memStats.allocBytes) },
        { label: "系统内存", value: fmtBytes(runtime.memStats.sysBytes) },
        { label: "堆对象数", value: runtime.memStats.heapObjects.toString() },
        { label: "GC 次数", value: runtime.gc.numGC.toString() },
        { label: "GC 总耗时", value: fmtNsToMs(runtime.gc.pauseTotalNs) },
        { label: "上次 GC", value: fmtNsToMs(runtime.gc.lastPauseNs) },
    ];
    return (
        <div>
            <h3 className="mb-3 font-semibold">运行时</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {items.map((it) => (
                    <div key={it.label} className="bg-muted/50 rounded-lg p-2">
                        <p className="text-muted-foreground text-xs">{it.label}</p>
                        <p className="truncate text-sm font-medium">{it.value}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
