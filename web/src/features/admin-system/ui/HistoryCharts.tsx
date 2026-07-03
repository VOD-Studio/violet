import { Activity, Cpu, Gauge, HardDrive, MemoryStick, Network } from "lucide-react";
import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
    type ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/shared/ui/base/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/base/tabs";
import { fmtBytes, fmtTime } from "../model/format";
import type { HistoryResponse } from "../model/types";

interface HistoryChartsProps {
    data?: HistoryResponse;
    isLoading: boolean;
}

const tabsConfig = [
    { value: "cpu", label: "CPU", icon: Cpu },
    { value: "mem", label: "内存", icon: MemoryStick },
    { value: "disk", label: "磁盘 IO", icon: HardDrive },
    { value: "net", label: "网络 IO", icon: Network },
    { value: "load", label: "负载", icon: Gauge },
    { value: "runtime", label: "运行时", icon: Activity },
] as const;

/**
 * HistoryCharts - 历史趋势图区（6 Tab，shadcn chart + 动画）
 *
 * 数据更新时 recharts 自动播放新旧值过渡动画。
 */
export function HistoryCharts({ data, isLoading }: HistoryChartsProps) {
    if (isLoading || !data) {
        return <div className="bg-card h-80 animate-pulse rounded-xl border" />;
    }
    if (data.points.length === 0) {
        return (
            <div className="bg-card text-muted-foreground flex h-80 items-center justify-center rounded-xl border text-sm">
                暂无历史数据（采样器启动后将逐步生成）
            </div>
        );
    }

    return (
        <Tabs defaultValue="cpu" className="bg-card rounded-xl border p-4">
            <TabsList className="flex-wrap">
                {tabsConfig.map((t) => (
                    <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
                        <t.icon className="size-4" />
                        {t.label}
                    </TabsTrigger>
                ))}
            </TabsList>
            <ChartsContent points={data.points} />
        </Tabs>
    );
}

function ChartsContent({ points }: { points: HistoryResponse["points"] }) {
    return (
        <div className="mt-4 h-72">
            <TabsContent value="cpu" className="mt-0 h-full">
                <CPUChart points={points} />
            </TabsContent>
            <TabsContent value="mem" className="mt-0 h-full">
                <MemoryChart points={points} />
            </TabsContent>
            <TabsContent value="disk" className="mt-0 h-full">
                <DiskChart points={points} />
            </TabsContent>
            <TabsContent value="net" className="mt-0 h-full">
                <NetworkChart points={points} />
            </TabsContent>
            <TabsContent value="load" className="mt-0 h-full">
                <LoadChart points={points} />
            </TabsContent>
            <TabsContent value="runtime" className="mt-0 h-full">
                <RuntimeChart points={points} />
            </TabsContent>
        </div>
    );
}

// ---- 各 Tab 图表 ----

function CPUChart({ points }: { points: HistoryResponse["points"] }) {
    const cpuConfig = {
        usage: { label: "综合使用率", color: "var(--chart-1)" },
    } satisfies ChartConfig;
    return (
        <ChartContainer config={cpuConfig} className="h-full">
            <LineChart data={points}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="ts" tickFormatter={fmtTime} tickLine={false} axisLine={false} />
                <YAxis
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                />
                <ChartTooltip content={<ChartTooltipContent indicator="line" labelKey="usage" />} />
                <Line
                    dataKey="cpu.u"
                    name="综合使用率"
                    type="monotone"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive
                    animationDuration={1200}
                    animationEasing="ease-out"
                />
            </LineChart>
        </ChartContainer>
    );
}

function MemoryChart({ points }: { points: HistoryResponse["points"] }) {
    const memConfig = {
        used: { label: "已用 %", color: "var(--chart-2)" },
    } satisfies ChartConfig;
    return (
        <ChartContainer config={memConfig} className="h-full">
            <AreaChart data={points}>
                <defs>
                    <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0.1} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="ts" tickFormatter={fmtTime} tickLine={false} axisLine={false} />
                <YAxis
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                />
                <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                <Area
                    dataKey="m.up"
                    name="已用 %"
                    type="monotone"
                    stroke="var(--chart-2)"
                    strokeWidth={2}
                    fill="url(#memGrad)"
                    isAnimationActive
                    animationDuration={1200}
                    animationEasing="ease-out"
                />
            </AreaChart>
        </ChartContainer>
    );
}

function DiskChart({ points }: { points: HistoryResponse["points"] }) {
    // 取第一个挂载点的读写速率（由累计值差分近似）
    const chartData = useMemo(() => {
        return points.map((p, i) => {
            const cur = p.d[0];
            const prev = i > 0 ? points[i - 1].d[0] : null;
            let readRate = 0;
            let writeRate = 0;
            if (cur && prev) {
                readRate = cur.rb - prev.rb;
                writeRate = cur.wb - prev.wb;
            }
            return { ts: p.ts, readRate, writeRate };
        });
    }, [points]);
    const diskConfig = {
        read: { label: "读取", color: "var(--chart-3)" },
        write: { label: "写入", color: "var(--chart-4)" },
    } satisfies ChartConfig;
    return (
        <ChartContainer config={diskConfig} className="h-full">
            <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="ts" tickFormatter={fmtTime} tickLine={false} axisLine={false} />
                <YAxis
                    tickFormatter={(v) => fmtBytes(v)}
                    tickLine={false}
                    axisLine={false}
                    width={64}
                />
                <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                <Line
                    dataKey="readRate"
                    name="读取"
                    type="monotone"
                    stroke="var(--chart-3)"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive
                    animationDuration={1200}
                />
                <Line
                    dataKey="writeRate"
                    name="写入"
                    type="monotone"
                    stroke="var(--chart-4)"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive
                    animationDuration={1200}
                />
            </LineChart>
        </ChartContainer>
    );
}

function NetworkChart({ points }: { points: HistoryResponse["points"] }) {
    const netConfig = {
        sent: { label: "发送", color: "var(--chart-4)" },
        recv: { label: "接收", color: "var(--chart-2)" },
    } satisfies ChartConfig;
    return (
        <ChartContainer config={netConfig} className="h-full">
            <AreaChart data={points}>
                <defs>
                    <linearGradient id="netSendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--chart-4)" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="var(--chart-4)" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="netRecvGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0.05} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="ts" tickFormatter={fmtTime} tickLine={false} axisLine={false} />
                <YAxis
                    tickFormatter={(v) => fmtBytes(v)}
                    tickLine={false}
                    axisLine={false}
                    width={64}
                />
                <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                <Area
                    dataKey="n.sr"
                    name="发送"
                    type="monotone"
                    stroke="var(--chart-4)"
                    strokeWidth={2}
                    fill="url(#netSendGrad)"
                    isAnimationActive
                    animationDuration={1200}
                />
                <Area
                    dataKey="n.rr"
                    name="接收"
                    type="monotone"
                    stroke="var(--chart-2)"
                    strokeWidth={2}
                    fill="url(#netRecvGrad)"
                    isAnimationActive
                    animationDuration={1200}
                />
            </AreaChart>
        </ChartContainer>
    );
}

function LoadChart({ points }: { points: HistoryResponse["points"] }) {
    const loadConfig = {
        l1: { label: "1 min", color: "var(--chart-1)" },
        l5: { label: "5 min", color: "var(--chart-2)" },
        l15: { label: "15 min", color: "var(--chart-3)" },
    } satisfies ChartConfig;
    return (
        <ChartContainer config={loadConfig} className="h-full">
            <LineChart data={points}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="ts" tickFormatter={fmtTime} tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={40} />
                <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                <Line
                    dataKey="ld.l1"
                    name="1 min"
                    type="monotone"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive
                    animationDuration={1200}
                />
                <Line
                    dataKey="ld.l5"
                    name="5 min"
                    type="monotone"
                    stroke="var(--chart-2)"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive
                    animationDuration={1200}
                />
                <Line
                    dataKey="ld.l15"
                    name="15 min"
                    type="monotone"
                    stroke="var(--chart-3)"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive
                    animationDuration={1200}
                />
            </LineChart>
        </ChartContainer>
    );
}

function RuntimeChart({ points }: { points: HistoryResponse["points"] }) {
    const rtConfig = {
        goroutines: { label: "Goroutines", color: "var(--chart-1)" },
        gc: { label: "GC 次数", color: "var(--chart-5)" },
    } satisfies ChartConfig;
    return (
        <ChartContainer config={rtConfig} className="h-full">
            <LineChart data={points}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="ts" tickFormatter={fmtTime} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" tickLine={false} axisLine={false} width={40} />
                <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickLine={false}
                    axisLine={false}
                    width={40}
                />
                <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                <Line
                    yAxisId="left"
                    dataKey="rt.gr"
                    name="Goroutines"
                    type="monotone"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive
                    animationDuration={1200}
                />
                <Line
                    yAxisId="right"
                    dataKey="rt.gc"
                    name="GC 次数"
                    type="monotone"
                    stroke="var(--chart-5)"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive
                    animationDuration={1200}
                />
            </LineChart>
        </ChartContainer>
    );
}
