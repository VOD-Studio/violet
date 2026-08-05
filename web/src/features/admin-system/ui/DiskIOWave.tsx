import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@shared/ui/base/chart";
import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import type { SystemDiskInfoDTO, SystemHistoryDTO, SystemSamplePointDTO } from "../model/types";
import { formatBytes, formatPercent, thresholdColor } from "./format";
import { useFirstRender } from "./useFirstRender";

/** DiskIOWaveProps - 磁盘 IO 心跳波 props */
interface DiskIOWaveProps {
	/** 历史采样点（提供各挂载点读写累计值，差分为速率） */
	history: SystemHistoryDTO;
	/** 实时快照的磁盘列表（提供当前容量与使用率，压成角落） */
	disks: SystemDiskInfoDTO[];
}

/** DiskIOWave - 磁盘 IO 心跳波
 *
 * 主视觉是每个挂载点的读/写速率双线（由历史采样累计值差分），容量信息压成角落小字。
 * 突出「磁盘在忙什么」而非「还剩多少」。首屏播放动画，轮询走静态。
 */
export function DiskIOWave({ history, disks }: DiskIOWaveProps) {
	if (!disks.length) {
		return <p className="text-muted-foreground text-sm">暂无磁盘数据</p>;
	}

	return (
		<div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
			{disks.map((d) => (
				<DiskWaveCard key={d.path} disk={d} points={history.points} />
			))}
		</div>
	);
}

/** DiskWaveCardProps - 单挂载点 IO 心跳卡 props */
interface DiskWaveCardProps {
	/** 单挂载点磁盘容量信息 */
	disk: SystemDiskInfoDTO;
	/** 历史采样点 */
	points: SystemSamplePointDTO[];
}

/** diskIOConfig - 读/写双线 chart 配置 */
const diskIOConfig = {
	read: { label: "读取", color: "var(--chart-3)" },
	write: { label: "写入", color: "var(--chart-4)" },
} satisfies ChartConfig;

/** DiskWaveCard - 单挂载点的 IO 双线 + 角落容量 */
function DiskWaveCard({ disk, points }: DiskWaveCardProps) {
	const isFirst = useFirstRender(points);
	// 按 path 匹配该挂载点的采样，累计值差分为 30s 间隔的速率
	const chartData = useMemo(() => {
		const out: { ts: string; read: number; write: number }[] = [];
		let prev: SystemSamplePointDTO["d"][number] | null = null;
		for (const p of points) {
			const cur = p.d.find((x) => x.p === disk.path);
			if (!cur) continue;
			if (prev) {
				out.push({
					ts: p.ts,
					read: Math.max(cur.rb - prev.rb, 0),
					write: Math.max(cur.wb - prev.wb, 0),
				});
			}
			prev = cur;
		}
		return out;
	}, [points, disk.path]);

	const color = thresholdColor(disk.usedPercent);
	const lastRead = chartData.at(-1)?.read ?? 0;
	const lastWrite = chartData.at(-1)?.write ?? 0;

	return (
		<div className="border-border bg-card rounded-xl border p-3">
			<div className="mb-1 flex items-baseline justify-between">
				<h4 className="truncate font-mono text-sm font-medium">{disk.path}</h4>
				{/* 角落容量小字 */}
				<span className="text-xs tabular-nums" style={{ color }}>
					{formatPercent(disk.usedPercent, 0)} · {formatBytes(disk.usedBytes)}/
					{formatBytes(disk.totalBytes)}
				</span>
			</div>
			{/* 实时读写速率 */}
			<div className="text-muted-foreground mb-2 flex gap-4 text-xs">
				<span>
					读 <span className="text-foreground font-medium">{formatBytes(lastRead)}</span>
				</span>
				<span>
					写 <span className="text-foreground font-medium">{formatBytes(lastWrite)}</span>
				</span>
			</div>
			<ChartContainer config={diskIOConfig} className="h-24 w-full">
				<LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
					<CartesianGrid vertical={false} strokeDasharray="3 3" />
					<XAxis dataKey="ts" hide />
					<YAxis hide />
					<ChartTooltip
						content={
							<ChartTooltipContent
								labelFormatter={(_, payload) => {
									const ts = payload?.[0]?.payload?.ts as string | undefined;
									return ts ? ts.slice(11, 16) : "";
								}}
								formatter={(value, name) => (
									<span className="text-foreground font-mono">
										{name}: {formatBytes(Number(value))}
									</span>
								)}
							/>
						}
					/>
					<Line
						type="monotone"
						dataKey="read"
						name="read"
						stroke="var(--chart-3)"
						strokeWidth={1.5}
						dot={false}
						isAnimationActive={isFirst}
						animationDuration={1200}
						animationEasing="ease-out"
					/>
					<Line
						type="monotone"
						dataKey="write"
						name="write"
						stroke="var(--chart-4)"
						strokeWidth={1.5}
						dot={false}
						isAnimationActive={isFirst}
						animationDuration={1200}
						animationEasing="ease-out"
					/>
				</LineChart>
			</ChartContainer>
		</div>
	);
}
