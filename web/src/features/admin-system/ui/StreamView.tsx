import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@shared/ui/base/chart";
import { format } from "date-fns";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { SystemHistoryDTO, SystemSamplePointDTO, SystemSnapshotDTO } from "../model/types";
import { formatPercent, formatRate } from "./format";
import { DependencyStatus } from "./sections/DependencyStatus";
import { useFirstRender } from "./useFirstRender";

/** StreamViewProps - 心率式时序带视图 props */
interface StreamViewProps {
	/** 当前实时快照（用于顶部依赖状态条） */
	snapshot: SystemSnapshotDTO;
	/** 历史采样点（驱动各指标时序曲线） */
	history: SystemHistoryDTO;
}

/**
 * StreamView - 心率式时序带视图
 *
 * 顶部一条依赖状态条，下方每指标一行 AreaChart，x 轴为时间。
 * 「时序为主」的设计方向：把 24h/30s 历史曲线作为主角，瞬时数字作附属注释。
 */
export function StreamView({ snapshot, history }: StreamViewProps) {
	return (
		<div className="space-y-6">
			{/* 依赖状态条：常驻顶部，绿/红点 + 延迟，报警色一眼可辨 */}
			<div className="border-border bg-card flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-2.5">
				<DependencyStatus dependencies={snapshot.dependencies} compact />
				<span className="text-muted-foreground text-xs">
					更新于 {format(new Date(snapshot.timestamp), "HH:mm:ss")}
				</span>
			</div>

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<MetricChart
					title="CPU 使用率"
					points={history.points}
					color="var(--chart-1)"
					accessor={(p) => p.cpu.u}
					formatValue={formatPercent}
					domain={[0, 100]}
				/>
				<MetricChart
					title="内存使用率"
					points={history.points}
					color="var(--chart-2)"
					accessor={(p) => p.m.up}
					formatValue={formatPercent}
					domain={[0, 100]}
				/>
				<MetricChart
					title="网络发送速率"
					points={history.points}
					color="var(--chart-3)"
					accessor={(p) => p.n.sr}
					formatValue={formatRate}
				/>
				<MetricChart
					title="网络接收速率"
					points={history.points}
					color="var(--chart-4)"
					accessor={(p) => p.n.rr}
					formatValue={formatRate}
				/>
				<MetricChart
					title="goroutines"
					points={history.points}
					color="var(--chart-5)"
					accessor={(p) => p.rt.gr}
					formatValue={(v) => String(Math.round(v))}
				/>
				<MetricChart
					title="系统负载（1min）"
					points={history.points}
					color="var(--chart-1)"
					accessor={(p) => p.ld.l1}
					formatValue={(v) => v.toFixed(2)}
				/>
			</div>
		</div>
	);
}

/** MetricChartProps - 单指标时序图 props */
interface MetricChartProps {
	/** 图表标题 */
	title: string;
	/** 历史采样点 */
	points: SystemSamplePointDTO[];
	/** 曲线颜色（CSS 变量） */
	color: string;
	/** 从采样点提取指标值 */
	accessor: (p: SystemSamplePointDTO) => number;
	/** 数值格式化函数 */
	formatValue: (v: number) => string;
	/** y 轴定义域，缺省自适应 */
	domain?: [number, number];
}

/** MetricChart - 单指标的紧凑时序 AreaChart（无 y 轴刻度，靠 tooltip 读数） */
function MetricChart({ title, points, color, accessor, formatValue, domain }: MetricChartProps) {
	const config: ChartConfig = { value: { label: title, color } };
	// 首屏播放动画，轮询刷新走静态避免抖动（recharts 不支持续接动画）
	const isFirst = useFirstRender(points);
	const data = points.map((p) => ({
		ts: p.ts,
		value: accessor(p),
	}));

	return (
		<div className="border-border bg-card rounded-lg border p-3">
			<div className="mb-1 flex items-baseline justify-between">
				<h4 className="text-sm font-medium">{title}</h4>
				{data.length > 0 && (
					<span className="text-muted-foreground text-xs tabular-nums">
						{formatValue(data[data.length - 1].value)}
					</span>
				)}
			</div>
			<ChartContainer config={config} className="h-24 w-full">
				<AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
					<defs>
						<linearGradient id={`grad-${title}`} x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stopColor={color} stopOpacity={0.3} />
							<stop offset="100%" stopColor={color} stopOpacity={0} />
						</linearGradient>
					</defs>
					<CartesianGrid vertical={false} strokeDasharray="3 3" />
					<XAxis
						dataKey="ts"
						tickLine={false}
						axisLine={false}
						tick={{ fontSize: 10 }}
						tickFormatter={(v: string) => format(new Date(v), "HH:mm")}
						minTickGap={40}
					/>
					{domain && <YAxis hide domain={domain} />}
					<ChartTooltip
						content={
							<ChartTooltipContent
								labelFormatter={(_, payload) => {
									const ts = payload?.[0]?.payload?.ts as string | undefined;
									return ts ? format(new Date(ts), "MM-dd HH:mm:ss") : "";
								}}
								formatter={(value) => (
									<span className="text-foreground font-mono">
										{formatValue(Number(value))}
									</span>
								)}
							/>
						}
					/>
					<Area
						type="monotone"
						dataKey="value"
						stroke={color}
						strokeWidth={1.5}
						fill={`url(#grad-${title})`}
						isAnimationActive={isFirst}
						animationDuration={1200}
						animationEasing="ease-out"
						dot={false}
					/>
				</AreaChart>
			</ChartContainer>
		</div>
	);
}
