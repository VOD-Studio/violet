import { cn } from "@shared/lib/utils";

import { fmtPercent, thresholdColor } from "../model/format";
import { useCountUp } from "./useCountUp";

interface MetricCardProps {
    /** 标题（如「CPU」） */
    title: string;
    /** 主数值（百分比 0-100，用于环形进度与变色） */
    percent: number;
    /** 副信息行 */
    subtitle?: string;
    /** lucide 图标 */
    icon: React.ReactNode;
    /** 是否正在加载（显示骨架） */
    isLoading?: boolean;
    /** stagger 入场延迟（ms） */
    delay?: number;
}

/**
 * MetricCard - 实时指标卡
 *
 * 大号百分比数字（useCountUp 滚动）+ SVG 环形进度环 + 阈值变色 + 入场动画。
 */
export function MetricCard({
    title,
    percent,
    subtitle,
    icon,
    isLoading,
    delay = 0,
}: MetricCardProps) {
    const display = useCountUp(percent, 800, 1);
    const color = thresholdColor(percent);
    // 环形进度参数
    const radius = 28;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (display / 100) * circumference;

    if (isLoading) {
        return <div className="bg-card h-32 animate-pulse rounded-xl border" />;
    }

    return (
        <div
            className="bg-card animate-fade-in-up flex items-center gap-4 rounded-xl border p-4"
            style={{ animationDelay: `${delay}ms` }}
        >
            {/* 环形进度环 */}
            <div className="relative h-16 w-16 shrink-0">
                <svg
                    className="h-16 w-16 -rotate-90"
                    viewBox="0 0 64 64"
                    role="img"
                    aria-label={`${title} 使用率`}
                >
                    <circle
                        cx="32"
                        cy="32"
                        r={radius}
                        fill="none"
                        strokeWidth="6"
                        className="stroke-muted"
                    />
                    <circle
                        cx="32"
                        cy="32"
                        r={radius}
                        fill="none"
                        strokeWidth="6"
                        strokeLinecap="round"
                        stroke={color}
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        style={{ transition: "stroke-dashoffset 0.7s ease-out, stroke 0.5s ease" }}
                    />
                </svg>
                <span className="text-muted-foreground absolute inset-0 flex items-center justify-center text-lg">
                    {icon}
                </span>
            </div>
            {/* 文本 */}
            <div className="min-w-0">
                <p className="text-muted-foreground truncate text-sm">{title}</p>
                <p
                    className={cn("text-2xl font-bold tabular-nums")}
                    style={{ color, transition: "color 0.5s ease" }}
                >
                    {fmtPercent(display)}
                </p>
                {subtitle && <p className="text-muted-foreground truncate text-xs">{subtitle}</p>}
            </div>
        </div>
    );
}
