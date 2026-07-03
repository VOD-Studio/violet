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

/** GaugeItem - 单个环形仪表的渲染数据（填充比例与显示文本解耦） */
interface GaugeItem {
    /** 对应右侧时序图的指标键 */
    key: MetricKey;
    /** 仪表标签 */
    label: string;
    /** 环色（CSS 变量） */
    color: string;
    /** 环填充比例，0-1 */
    ratio: number;
    /** 环中央显示文本 */
    display: string;
}

/** ConsoleView - 控制台视图：左侧环形仪表组 + 右侧选中指标时序图 */
export function ConsoleView({ snapshot, history }: ConsoleViewProps) {
    const [selected, setSelected] = useState<MetricKey>("cpu");

    const cores = snapshot.cpu.cores || 1;
    const gauges: GaugeItem[] = [
        {
            key: "cpu",
            label: "CPU",
            color: "var(--chart-1)",
            ratio: snapshot.cpu.usagePercent / 100,
            display: formatPercent(snapshot.cpu.usagePercent, 0),
        },
        {
            key: "mem",
            label: "内存",
            color: "var(--chart-2)",
            ratio: snapshot.memory.usedPercent / 100,
            display: formatPercent(snapshot.memory.usedPercent, 0),
        },
        {
            key: "load",
            label: "负载",
            color: "var(--chart-3)",
            // 负载满量程 = 核心数；环按负载/核数填充，中央显示原始 load 值
            ratio: Math.min(snapshot.load.load1 / cores, 1),
            display: snapshot.load.load1.toFixed(2),
        },
        {
            key: "goroutines",
            label: "goroutines",
            color: "var(--chart-4)",
            // goroutines 满量程取 2000（经验值），环按比例填充，中央显示真实数量
            ratio: Math.min(snapshot.runtime.goroutines / 2000, 1),
            display: String(snapshot.runtime.goroutines),
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
                                color={g.color}
                                ratio={g.ratio}
                                display={g.display}
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
    /** 环色（CSS 变量） */
    color: string;
    /** 环填充比例，0-1 */
    ratio: number;
    /** 环中央显示文本 */
    display: string;
    /** 点击切换右侧时序图 */
    onClick: () => void;
    /** 是否选中（高亮） */
    active: boolean;
}

/** Gauge - 单个环形仪表（点击联动右侧时序图） */
function Gauge({ label, color, ratio, display, onClick, active }: GaugeProps) {
    const config: ChartConfig = { value: { label, color } };
    const data = [{ name: label, value: Math.min(Math.max(ratio, 0), 1) * 100 }];

    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex flex-col items-center rounded-md p-1 transition-colors ${active ? "bg-accent" : "hover:bg-accent/50"}`}
        >
            {/* 环 + 中央数字：数字用绝对定位真正居中于环内 */}
            <div className="relative size-20">
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
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-semibold tabular-nums">{display}</span>
                </div>
            </div>
            <span className="text-muted-foreground mt-1 text-xs">{label}</span>
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
