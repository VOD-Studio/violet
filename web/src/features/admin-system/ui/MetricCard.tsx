import { cn } from "@shared/lib/utils";
import type { ReactNode } from "react";
import { formatPercent, thresholdColor } from "./format";
import { useCountUp } from "./useCountUp";

/** MetricCardProps - 实时指标卡 props */
interface MetricCardProps {
	/** 标题（如「CPU」） */
	title: string;
	/**
	 * 主数值。
	 * - 传入 `percent`（0-100）时，按百分比渲染环填充、变色与文本。
	 * - 传入 `ratio`（0-1）+ `display`（文本）时，按比例填充、显示自定义文本，不变色。
	 */
	percent?: number;
	/** 环填充比例（0-1），与 percent 二选一 */
	ratio?: number;
	/** 环中央与正文显示文本（ratio 模式必填） */
	display?: string;
	/** 副信息行 */
	subtitle?: string;
	/** lucide 图标 */
	icon: ReactNode;
	/** 是否正在加载（显示骨架） */
	isLoading?: boolean;
	/** stagger 入场延迟（ms） */
	delay?: number;
}

/**
 * MetricCard - 实时指标卡
 *
 * 大号数字（useCountUp 滚动）+ SVG 环形进度环 + 阈值变色 + 入场动画。
 * SVG 手绘环避免 recharts 重渲染开销，轮询刷新时仅 CSS transition 平滑过渡。
 *
 * 两种用法：
 *  - 百分比指标（CPU/内存/磁盘）：传 `percent`，自动按 0-100 填充、变色、格式化为 `xx.x%`。
 *  - 任意指标（负载/goroutines）：传 `ratio`（0-1 填充）+ `display`（中央文本），颜色恒定。
 */
export function MetricCard({
	title,
	percent,
	ratio,
	display,
	subtitle,
	icon,
	isLoading,
	delay = 0,
}: MetricCardProps) {
	// 归一化为 0-100 的环填充量与中央文本
	const fillPercent = percent ?? (ratio ?? 0) * 100;
	const animated = useCountUp(fillPercent, 800, 1);
	const color = percent !== undefined ? thresholdColor(percent) : "var(--chart-2)";
	const text = display ?? formatPercent(animated);

	// 环形进度参数
	const radius = 28;
	const circumference = 2 * Math.PI * radius;
	const offset = circumference - (animated / 100) * circumference;

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
						style={{
							transition: "stroke-dashoffset 0.7s ease-out, stroke 0.5s ease",
						}}
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
					{text}
				</p>
				{subtitle && <p className="text-muted-foreground truncate text-xs">{subtitle}</p>}
			</div>
		</div>
	);
}
