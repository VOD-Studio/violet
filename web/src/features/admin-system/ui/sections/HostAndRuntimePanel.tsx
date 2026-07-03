import type { SystemHostInfoDTO, SystemRuntimeInfoDTO } from "../../model/types";
import { formatBytes, formatNsToMs, formatUptime } from "../format";

/** HostAndRuntimePanelProps - 主机信息 + Go 运行时面板 props */
interface HostAndRuntimePanelProps {
    /** 主机信息 */
    host: SystemHostInfoDTO;
    /** Go 运行时信息 */
    runtime: SystemRuntimeInfoDTO;
}

/** HostAndRuntimePanel - 主机信息与 Go 运行时静态信息面板 */
export function HostAndRuntimePanel({ host, runtime }: HostAndRuntimePanelProps) {
    return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <InfoBlock title="主机信息">
                <InfoRow label="主机名" value={host.hostname} />
                <InfoRow label="系统" value={`${host.os} ${host.platform}`} />
                <InfoRow label="架构" value={host.kernelArch} />
            </InfoBlock>

            <InfoBlock title="Go 运行时">
                <InfoRow label="版本" value={runtime.goVersion} />
                <InfoRow label="运行时长" value={formatUptime(runtime.uptimeSeconds)} />
                <InfoRow label="goroutines" value={String(runtime.goroutines)} />
                <InfoRow label="线程数" value={String(runtime.numThreads)} />
                <InfoRow label="CGO 调用" value={String(runtime.numCgoCall)} />
                <InfoRow label="堆分配" value={formatBytes(runtime.memStats.allocBytes)} />
                <InfoRow label="堆对象" value={String(runtime.memStats.heapObjects)} />
                <InfoRow label="GC 次数" value={String(runtime.gc.numGC)} />
                <InfoRow label="GC 总暂停" value={formatNsToMs(runtime.gc.pauseTotalNs)} />
                <InfoRow label="上次 GC 暂停" value={formatNsToMs(runtime.gc.lastPauseNs)} />
            </InfoBlock>
        </div>
    );
}

/** InfoBlock - 信息区块容器（标题 + KV 列表） */
function InfoBlock({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="border-border bg-card rounded-lg border p-4">
            <h3 className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
                {title}
            </h3>
            <dl className="grid gap-1.5 text-sm">{children}</dl>
        </div>
    );
}

/** InfoRow - 单行键值对 */
function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{label}</dt>
            <dd
                className="text-foreground truncate font-mono text-right tabular-nums"
                title={value}
            >
                {value}
            </dd>
        </div>
    );
}
