import {
    type ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@shared/ui/base/chart";
import { format } from "date-fns";
import { useState } from "react";
import {
    Area,
    AreaChart,
    CartesianGrid,
    PolarAngleAxis,
    RadialBar,
    RadialBarChart,
    XAxis,
    YAxis,
} from "recharts";
import type { SystemHistoryDTO, SystemSamplePointDTO, SystemSnapshotDTO } from "../model/types";
import { formatPercent, formatRate, formatUptime } from "./format";
import { DependencyStatus } from "./sections/DependencyStatus";

/** ConsoleViewProps - 控制台环形仪表视图 props */
interface ConsoleViewProps {
    /** 当前实时快照（驱动环形仪表与中央 uptime） */
    snapshot: SystemSnapshotDTO;
    /** 历史采样点（驱动右侧选中指标时序图） */
    history: SystemHistoryDTO;
}

/** MetricKey - 可在右侧时序图展示的指标键 */
type MetricKey = "cpu" | "mem" | "netSent" | "netRecv" | "goroutines" | "load";

/** ConsoleView - 控制台视图：左侧环形仪表组 + 右侧选中指标时序图 */
export function ConsoleView({ snapshot, history }: ConsoleViewProps) {
    const [selected, setSelected] = useState<MetricKey>("cpu");

    const gauges = [
        {
            key: "cpu" as const,
            label: "CPU",
            value: snapshot.cpu.usagePercent,
            max: 100,
            color: "var(--chart-1)",
        },
        {
            key: "mem" as const,
            label: "内存",
            value: snapshot.memory.usedPercent,
            max: 100,
            color: "var(--chart-2)",
        },
        {
            key: "load" as const,
            label: "负载",
            value: snapshot.load.load1,
            max: snapshot.cpu.cores || 1,
            color: "var(--chart-3)",
        },
        {
            key: "goroutines" as const,
            label: "GC",
            value: snapshot.runtime.gc.numGC % 100,
            max: 100,
            color: "var(--chart-4)",
        },
    ];

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* 左侧：环形仪表组 + 中央 uptime */}
                <div className="border-border bg-card relative rounded-lg border p-4">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
                        {gauges.map((g) => (
                            <Gauge
                                key={g.key}
                                label={g.label}
                                value={g.value}
                                max={g.max}
                                color={g.color}
                                onClick={() => setSelected(g.key)}
                                active={selected === g.key}
                            />
                        ))}
                    </div>
                    <div className="text-muted-foreground mt-4 text-center">
                        <div className="text-xs">uptime</div>
                        <div className="text-foreground text-lg font-semibold tabular-nums">
                            {formatUptime(snapshot.runtime.uptimeSeconds)}
                        </div>
                    </div>
                </div>

                {/* 右侧：选中指标的历史时序图 */}
                <div className="border-border bg-card rounded-lg border p-4">
                    <h4 className="mb-2 text-sm font-medium">
                        {METRIC_META[selected].label} · 历史
                    </h4>
                    <DetailChart history={history} metric={selected} />
                </div>
            </div>

            {/* 依赖状态卡 */}
            <div>
                <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                    依赖服务
                </h3>
                <DependencyStatus dependencies={snapshot.dependencies} />
            </div>
        </div>
    );
}

/** METRIC_META - 右侧时序图各指标的取值与格式化元信息 */
const METRIC_META: Record<
    MetricKey,
    {
        label: string;
        color: string;
        accessor: (p: SystemSamplePointDTO) => number;
        formatValue: (v: number) => string;
    }
> = {
    cpu: {
        label: "CPU 使用率",
        color: "var(--chart-1)",
        accessor: (p) => p.cpu.u,
        formatValue: formatPercent,
    },
    mem: {
        label: "内存使用率",
        color: "var(--chart-2)",
        accessor: (p) => p.m.up,
        formatValue: formatPercent,
    },
    netSent: {
        label: "网络发送速率",
        color: "var(--chart-3)",
        accessor: (p) => p.n.sr,
        formatValue: formatRate,
    },
    netRecv: {
        label: "网络接收速率",
        color: "var(--chart-4)",
        accessor: (p) => p.n.rr,
        formatValue: formatRate,
    },
    goroutines: {
        label: "goroutines",
        color: "var(--chart-5)",
        accessor: (p) => p.rt.gr,
        formatValue: (v) => String(Math.round(v)),
    },
    load: {
        label: "系统负载（1min）",
        color: "var(--chart-1)",
        accessor: (p) => p.ld.l1,
        formatValue: (v) => v.toFixed(2),
    },
};

/** GaugeProps - 单个环形仪表 props */
interface GaugeProps {
    /** 仪表标签 */
    label: string;
    /** 当前值 */
    value: number;
    /** 满量程 */
    max: number;
    /** 环色（CSS 变量） */
    color: string;
    /** 点击切换右侧时序图 */
    onClick: () => void;
    /** 是否选中（高亮） */
    active: boolean;
}

/** Gauge - 单个环形仪表（点击联动右侧时序图） */
function Gauge({ label, value, max, color, onClick, active }: GaugeProps) {
    const config: ChartConfig = { value: { label, color } };
    const clamped = max > 0 ? Math.min(value / max, 1) : 0;
    const data = [{ name: label, value: clamped * 100 }];
    const pct = max <= 100 ? value : clamped * 100;

    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex flex-col items-center rounded-md p-1 transition-colors ${active ? "bg-accent" : "hover:bg-accent/50"}`}
        >
            <ChartContainer config={config} className="size-20">
                <RadialBarChart
                    data={data}
                    startAngle={90}
                    endAngle={-270}
                    innerRadius="70%"
                    outerRadius="100%"
                >
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar
                        dataKey="value"
                        background
                        cornerRadius={6}
                        fill={color}
                        isAnimationActive={false}
                    />
                </RadialBarChart>
            </ChartContainer>
            <div className="-mt-10 mb-1 text-center">
                <div className="text-sm font-semibold tabular-nums">
                    {max <= 100 ? formatPercent(pct as number, 0) : value.toFixed(2)}
                </div>
            </div>
            <span className="text-muted-foreground text-xs">{label}</span>
        </button>
    );
}

/** DetailChartProps - 右侧时序图 props */
interface DetailChartProps {
    /** 历史采样点 */
    history: SystemHistoryDTO;
    /** 当前选中指标 */
    metric: MetricKey;
}

/** DetailChart - 右侧较大尺寸的时序 AreaChart，含 y 轴刻度 */
function DetailChart({ history, metric }: DetailChartProps) {
    const meta = METRIC_META[metric];
    const config: ChartConfig = { value: { label: meta.label, color: meta.color } };
    const data = history.points.map((p) => ({ ts: p.ts, value: meta.accessor(p) }));

    return (
        <ChartContainer config={config} className="h-48 w-full">
            <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <defs>
                    <linearGradient id={`detail-${metric}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={meta.color} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={meta.color} stopOpacity={0} />
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
                <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10 }}
                    width={48}
                    tickFormatter={(v: number) => meta.formatValue(v)}
                />
                <ChartTooltip
                    content={
                        <ChartTooltipContent
                            labelFormatter={(_, payload) => {
                                const ts = payload?.[0]?.payload?.ts as string | undefined;
                                return ts ? format(new Date(ts), "MM-dd HH:mm:ss") : "";
                            }}
                            formatter={(value) => (
                                <span className="text-foreground font-mono">
                                    {meta.formatValue(Number(value))}
                                </span>
                            )}
                        />
                    }
                />
                <Area
                    type="monotone"
                    dataKey="value"
                    stroke={meta.color}
                    strokeWidth={1.5}
                    fill={`url(#detail-${metric})`}
                    isAnimationActive={false}
                    dot={false}
                />
            </AreaChart>
        </ChartContainer>
    );
}
