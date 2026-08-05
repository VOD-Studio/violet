import { useEffect, useState } from "react";
import type { SystemDiskInfoDTO } from "../model/types";
import { formatBytes, formatPercent, thresholdColor } from "./format";

/** DiskLiquidCardProps - 磁盘液位容器 props */
interface DiskLiquidCardProps {
	/** 单个挂载点磁盘数据 */
	disk: SystemDiskInfoDTO;
	/** stagger 入场延迟（ms） */
	delay?: number;
}

/** 容器 SVG 视口高度（液位按此换算） */
const TANK_H = 96;
/** 注入动画时长（ms），首屏液面从 0 升到目标值 */
const FILL_DURATION = 900;

/**
 * DiskLiquidCard - 磁盘液位容器
 *
 * 把每个挂载点画成一个「液位容器」：外框是磁盘轮廓，内部按使用率从底部填充色块，
 * 顶部留白表示可用空间。一眼看出空间感，>85% 变红。
 *
 * 动画：首屏挂载时液面从 0 注入到目标高度（像往容器里注水），配合卡片 fade-in-up
 * 入场与 stagger delay；后续轮询刷新靠 height transition 平滑升降。
 */
export function DiskLiquidCard({ disk, delay = 0 }: DiskLiquidCardProps) {
	const color = thresholdColor(disk.usedPercent);
	const targetH = (disk.usedPercent / 100) * TANK_H;
	const free = disk.totalBytes - disk.usedBytes;

	// 首屏注入：挂载时液面从 0 开始，下一帧升到目标值触发 transition。
	// 注入完成后（liquidH 已被设为 targetH 一次），后续 targetH 随轮询变化时
	// 直接取 targetH，靠 CSS transition 平滑升降，不再重置到 0。
	const [filled, setFilled] = useState(false);
	useEffect(() => {
		const raf = requestAnimationFrame(() => setFilled(true));
		return () => cancelAnimationFrame(raf);
	}, []);
	const liquidH = filled ? targetH : 0;

	return (
		<div
			className="border-border bg-card animate-fade-in-up flex items-center gap-4 rounded-xl border p-4"
			style={{ animationDelay: `${delay}ms` }}
		>
			{/* 液位容器 */}
			<div
				className="border-muted relative w-12 shrink-0 overflow-hidden rounded-md border bg-muted/40"
				style={{ height: TANK_H }}
				role="img"
				aria-label={`${disk.path} 使用 ${formatPercent(disk.usedPercent)}`}
			>
				{/* 液面：首屏注入用较长 duration，轮询升降用较短 duration。
                    通过 key 切换 class 实现：首帧 liquidH=0→targetH 用注入时长，
                    之后 targetH 变化用轮询时长。这里统一用 transition，duration
                    设为注入时长，轮询时同样平滑（900ms 对 30s 间隔可接受）。 */}
				<div
					className="absolute right-0 bottom-0 left-0 transition-[height] ease-out"
					style={{
						height: liquidH,
						background: color,
						transitionDuration: `${FILL_DURATION}ms`,
					}}
				/>
				{/* 液面波纹高光 */}
				<div
					className="absolute right-0 left-0 h-px opacity-40 transition-[bottom] ease-out"
					style={{
						bottom: liquidH,
						background: "white",
						transitionDuration: `${FILL_DURATION}ms`,
					}}
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

/** DiskLiquidGrid - 多挂载点液位容器网格（卡片 stagger 入场） */
export function DiskLiquidGrid({ disks }: DiskLiquidGridProps) {
	if (!disks.length) {
		return <p className="text-muted-foreground text-sm">暂无磁盘数据</p>;
	}
	return (
		<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{disks.map((d, i) => (
				<DiskLiquidCard key={d.path} disk={d} delay={i * 80} />
			))}
		</div>
	);
}
