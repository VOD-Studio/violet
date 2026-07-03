import type { SystemDiskInfoDTO } from "../model/types";
import { formatBytes, formatPercent, thresholdColor } from "./format";

/** DiskLiquidCardProps - 磁盘液位容器 props */
interface DiskLiquidCardProps {
    /** 单个挂载点磁盘数据 */
    disk: SystemDiskInfoDTO;
}

/** 容器 SVG 视口高度（液位按此换算） */
const TANK_H = 96;

/**
 * DiskLiquidCard - 磁盘液位容器
 *
 * 把每个挂载点画成一个「液位容器」：外框是磁盘轮廓，内部按使用率从底部填充色块，
 * 顶部留白表示可用空间。一眼看出空间感，>85% 变红。
 * 用 CSS height transition 让轮询刷新时液面平滑升降。
 */
export function DiskLiquidCard({ disk }: DiskLiquidCardProps) {
    const color = thresholdColor(disk.usedPercent);
    const usedH = (disk.usedPercent / 100) * TANK_H;
    const free = disk.totalBytes - disk.usedBytes;

    return (
        <div className="border-border bg-card flex items-center gap-4 rounded-xl border p-4">
            {/* 液位容器 */}
            <div
                className="border-muted relative w-12 shrink-0 overflow-hidden rounded-md border bg-muted/40"
                style={{ height: TANK_H }}
                role="img"
                aria-label={`${disk.path} 使用 ${formatPercent(disk.usedPercent)}`}
            >
                <div
                    className="absolute right-0 bottom-0 left-0 transition-[height] duration-700 ease-out"
                    style={{ height: usedH, background: color }}
                />
                {/* 液面波纹高光 */}
                <div
                    className="absolute right-0 left-0 h-px opacity-40 transition-[bottom] duration-700 ease-out"
                    style={{ bottom: usedH, background: "white" }}
                />
            </div>
            {/* 文本 */}
            <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm font-medium">{disk.path}</p>
                <p className="text-foreground text-2xl font-bold tabular-nums" style={{ color }}>
                    {formatPercent(disk.usedPercent, 0)}
                </p>
                <p className="text-muted-foreground text-xs">
                    剩 <span className="text-foreground font-medium">{formatBytes(free)}</span> 可用
                </p>
                <p className="text-muted-foreground text-xs">
                    {formatBytes(disk.usedBytes)} / {formatBytes(disk.totalBytes)}
                </p>
            </div>
        </div>
    );
}

/** DiskLiquidGridProps - 磁盘液位容器网格 props */
interface DiskLiquidGridProps {
    /** 各挂载点磁盘数据 */
    disks: SystemDiskInfoDTO[];
}

/** DiskLiquidGrid - 多挂载点液位容器网格 */
export function DiskLiquidGrid({ disks }: DiskLiquidGridProps) {
    if (!disks.length) {
        return <p className="text-muted-foreground text-sm">暂无磁盘数据</p>;
    }
    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {disks.map((d) => (
                <DiskLiquidCard key={d.path} disk={d} />
            ))}
        </div>
    );
}
