import {
    type ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@shared/ui/base/chart";
import { format } from "date-fns";
import { Activity, Cpu, Gauge as GaugeIcon, MemoryStick } from "lucide-react";
import { useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { SystemHistoryDTO, SystemSamplePointDTO, SystemSnapshotDTO } from "../model/types";
import { DependencyPanel } from "./DependencyPanel";
import { formatPercent, formatRate, formatUptime } from "./format";
import { MetricCard } from "./MetricCard";

/** ConsoleViewProps - 控制台指标卡视图 props */
interface ConsoleViewProps {
    /** 当前实时快照（驱动指标卡与 uptime） */
    snapshot: SystemSnapshotDTO;
    /** 历史采样点（驱动右侧选中指标时序图） */
    history: SystemHistoryDTO;
}

/** MetricKey - 可在右侧时序图展示的指标键 */
type MetricKey = "cpu" | "mem" | "netSent" | "netRecv" | "goroutines" | "load";

/** ConsoleView - 控制台视图：左侧 MetricCard 指标卡组 + 右侧选中指标时序图 */
export function ConsoleView({ snapshot, history }: ConsoleViewProps) {
    const [selected, setSelected] = useState<MetricKey>("cpu");

    const cores = snapshot.cpu.cores || 1;

    return (
        <div className="space-y-6">
            {/* 指标卡组：点击联动右侧时序图，选中态用 ring 高亮 */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <SelectableCard active={selected === "cpu"} onClick={() => setSelected("cpu")}>
                    <MetricCard
                        title="CPU"
                        percent={snapshot.cpu.usagePercent}
                        subtitle={`${cores} 核`}
                        icon={<Cpu className="size-5" />}
                        delay={0}
                    />
                </SelectableCard>
                <SelectableCard active={selected === "mem"} onClick={() => setSelected("mem")}>
                    <MetricCard
                        title="内存"
                        percent={snapshot.memory.usedPercent}
                        icon={<MemoryStick className="size-5" />}
                        delay={80}
                    />
                </SelectableCard>
                <SelectableCard active={selected === "load"} onClick={() => setSelected("load")}>
                    <MetricCard
                        title="负载"
                        ratio={Math.min(snapshot.load.load1 / cores, 1)}
                        display={snapshot.load.load1.toFixed(2)}
                        subtitle={`${cores} 核满载`}
                        icon={<GaugeIcon className="size-5" />}
                        delay={160}
                    />
                </SelectableCard>
                <SelectableCard
                    active={selected === "goroutines"}
                    onClick={() => setSelected("goroutines")}
                >
                    <MetricCard
                        title="goroutines"
                        ratio={Math.min(snapshot.runtime.goroutines / 2000, 1)}
                        display={String(snapshot.runtime.goroutines)}
                        subtitle={`GC ${snapshot.runtime.gc.numGC} 次`}
                        icon={<Activity className="size-5" />}
                        delay={240}
                    />
                </SelectableCard>
            </div>

            {/* uptime */}
            <div className="text-muted-foreground text-center text-sm">
                uptime{" "}
                <span className="text-foreground font-semibold tabular-nums">
                    {formatUptime(snapshot.runtime.uptimeSeconds)}
                </span>
            </div>

            {/* 选中指标的历史时序图 */}
            <div className="border-border bg-card rounded-lg border p-4">
                <h4 className="mb-2 text-sm font-medium">{METRIC_META[selected].label} · 历史</h4>
                <DetailChart history={history} metric={selected} />
            </div>

            {/* 依赖状态卡 */}
            <div>
                <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                    依赖服务
                </h3>
                <DependencyPanel data={snapshot} />
            </div>
        </div>
    );
}

/** SelectableCardProps - 可选中卡片容器 props */
interface SelectableCardProps {
    /** 点击选中 */
    onClick: () => void;
    /** 是否选中（ring 高亮） */
    active: boolean;
    /** 包裹的卡片内容 */
    children: React.ReactNode;
}

/** SelectableCard - 包裹 MetricCard 使其可点击选中，选中态用 ring 高亮 */
function SelectableCard({ onClick, active, children }: SelectableCardProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-xl text-left transition-shadow ${active ? "ring-2 ring-ring ring-offset-2 ring-offset-background" : "hover:ring-2 hover:ring-ring/40"}`}
        >
            {children}
        </button>
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
