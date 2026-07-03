import { type ChartConfig, ChartContainer } from "@shared/ui/base/chart";
import { useMemo } from "react";
import { Line, LineChart } from "recharts";
import type { SystemHistoryDTO, SystemRuntimeInfoDTO, SystemSamplePointDTO } from "../model/types";
import { formatBytes, formatUptime } from "./format";
import { useFirstRender } from "./useFirstRender";

/** RuntimePulseProps - 运行时脉搏面板 props */
interface RuntimePulseProps {
    /** Go 运行时实时信息（驱动大数字与静态信息行） */
    runtime: SystemRuntimeInfoDTO;
    /** 历史采样点（驱动三个遥测项的火花线） */
    history: SystemHistoryDTO;
}

/** RuntimePulse - Go 运行时脉搏面板
 *
 * 顶部三函数实时遥测：goroutines / GC 频率 / 堆分配，每个用大数字 + 迷你火花线
 * （随历史采样跳动，体现「活的」指标）。下方收起静态信息（版本/线程/CGO/uptime）
 * 为单行小字（「死的」指标）。
 */
export function RuntimePulse({ runtime, history }: RuntimePulseProps) {
    return (
        <div className="border-border bg-card rounded-xl border p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Telemetry
                    label="goroutines"
                    value={String(runtime.goroutines)}
                    points={history.points}
                    accessor={(p) => p.rt.gr}
                    color="var(--chart-1)"
                />
                <Telemetry
                    label="GC 频率"
                    value={`${gcRatePerSecond(history.points).toFixed(1)}/s`}
                    points={history.points}
                    accessor={(p) => p.rt.gc}
                    // GC 是累计计数，火花线展示斜率形态（用差分）
                    diff
                    color="var(--chart-5)"
                />
                <Telemetry
                    label="堆分配"
                    value={formatBytes(runtime.memStats.allocBytes)}
                    points={history.points}
                    accessor={(p) => p.m.ga}
                    color="var(--chart-2)"
                />
            </div>
            {/* 静态信息单行收起 */}
            <p className="text-muted-foreground mt-4 truncate text-center text-xs">
                {runtime.goVersion} · {runtime.numThreads} threads · {runtime.numCgoCall} cgo · up{" "}
                {formatUptime(runtime.uptimeSeconds)}
            </p>
        </div>
    );
}

/** gcRatePerSecond - 由历史 GC 累计计数差分计算平均 GC 频率（次/秒） */
function gcRatePerSecond(points: SystemSamplePointDTO[]): number {
    if (points.length < 2) return 0;
    const first = points[0];
    const last = points.at(-1);
    if (!last) return 0;
    const countDiff = last.rt.gc - first.rt.gc;
    if (countDiff <= 0) return 0;
    const seconds = (new Date(last.ts).getTime() - new Date(first.ts).getTime()) / 1000;
    if (seconds <= 0) return 0;
    return countDiff / seconds;
}

/** TelemetryProps - 单个遥测项 props */
interface TelemetryProps {
    /** 项名 */
    label: string;
    /** 当前大数字文本 */
    value: string;
    /** 历史采样点 */
    points: SystemSamplePointDTO[];
    /** 从采样点提取数值 */
    accessor: (p: SystemSamplePointDTO) => number;
    /** 是否用差分（累计计数展示斜率，如 GC） */
    diff?: boolean;
    /** 火花线颜色 */
    color: string;
}

/** Telemetry - 单个遥测项：大数字 + 迷你火花线 */
function Telemetry({ label, value, points, accessor, diff, color }: TelemetryProps) {
    const config: ChartConfig = { v: { label, color } } satisfies ChartConfig;
    const isFirst = useFirstRender(points);
    const data = useMemo(() => {
        if (diff) {
            // 差分：累计计数转为相邻差值，展示斜率形态
            const out: { v: number }[] = [];
            for (let i = 1; i < points.length; i++) {
                out.push({ v: accessor(points[i]) - accessor(points[i - 1]) });
            }
            return out;
        }
        return points.map((p) => ({ v: accessor(p) }));
    }, [points, accessor, diff]);

    return (
        <div className="flex items-end justify-between gap-2">
            <div>
                <p className="text-muted-foreground text-xs">{label}</p>
                <p className="text-foreground text-xl font-bold tabular-nums">{value}</p>
            </div>
            <ChartContainer config={config} className="h-8 w-24">
                <LineChart data={data}>
                    <Line
                        type="monotone"
                        dataKey="v"
                        stroke={color}
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
