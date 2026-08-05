"use client";

import { LayoutGrid, Table } from "lucide-react";
import type * as React from "react";
import {
	type CSSProperties,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { cn } from "@/shared/lib/utils";

/**
 * SegmentedItem - 分段器单项定义
 */
export interface SegmentedItem<V extends string = string> {
	/** 分段值 */
	value: V;
	/** 显示内容（文本或图标） */
	label: React.ReactNode;
	/** 是否禁用该段 */
	disabled?: boolean;
}

interface SegmentedProps<V extends string = string> {
	/** 当前选中值（受控） */
	value: V;
	/** 值变化回调 */
	onValueChange: (value: V) => void;
	/** 分段列表 */
	segments: SegmentedItem<V>[];
	/** 尺寸，默认 sm（与按钮高度对齐） */
	size?: "sm" | "default";
	/** 块级模式：宽度填满容器，各段等分 */
	block?: boolean;
	/** 自定义类名 */
	className?: string;
}

const sizeMap = {
	sm: "h-8 text-xs",
	default: "h-9 text-sm",
};

/**
 * Segmented - 分段控制器（带滑块平移动画）
 *
 * 受控组件，切换时滑块以 CSS transition 平滑滑动到目标位置。
 * 容器用 bg-muted（圆角胶囊），滑块用 bg-background + shadow-sm，
 * 文字根据选中态切换前景色。
 *
 * 滑块尺寸与位置根据当前激活按钮的实际 DOM 尺寸动态计算，
 * 因此各段文字长度不同时仍能精确包裹当前选中项。
 *
 * 常用于「网格/表格」视图切换、「列表/卡片」布局切换等二选一/多选一场景。
 *
 * @example
 * <Segmented
 *   value={view}
 *   onValueChange={setView}
 *   segments={[
 *     { value: "grid", label: <><LayoutGrid className="size-3.5" />网格</> },
 *     { value: "table", label: <><Table className="size-3.5" />表格</> },
 *   ]}
 * />
 */
export function Segmented<V extends string = string>({
	value,
	onValueChange,
	segments,
	size = "sm",
	block = false,
	className,
}: SegmentedProps<V>) {
	const activeIndex = Math.max(
		0,
		segments.findIndex((s) => s.value === value),
	);

	const containerRef = useRef<HTMLDivElement>(null);
	const [sliderStyle, setSliderStyle] = useState<CSSProperties>({});

	const updateSlider = useCallback(() => {
		const container = containerRef.current;
		if (!container) return;
		const buttons = Array.from(container.querySelectorAll("button"));
		const activeBtn = buttons[activeIndex];
		if (!activeBtn) return;
		setSliderStyle({
			left: activeBtn.offsetLeft,
			width: activeBtn.offsetWidth,
		});
	}, [activeIndex]);

	// 激活项变化或容器/按钮尺寸变化时重新计算滑块位置
	useLayoutEffect(updateSlider, [updateSlider]);
	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const resizeObserver = new ResizeObserver(updateSlider);
		resizeObserver.observe(container);
		for (const btn of container.querySelectorAll("button")) {
			resizeObserver.observe(btn);
		}
		return () => resizeObserver.disconnect();
	}, [updateSlider]);

	return (
		<div
			ref={containerRef}
			data-slot="segmented"
			className={cn(
				"relative flex items-stretch gap-0.5 rounded-lg bg-muted p-0.5 text-muted-foreground",
				block ? "w-full" : "inline-flex w-fit",
				sizeMap[size],
				className,
			)}
		>
			<span
				aria-hidden="true"
				className="absolute top-0.5 bottom-0.5 rounded-[calc(var(--radius-lg)-2px)] bg-background shadow-sm ring-1 ring-black/5 transition-[left,width] duration-200 ease-out dark:ring-white/10"
				style={sliderStyle}
			/>
			{segments.map((seg, i) => {
				const isActive = i === activeIndex;
				return (
					<button
						key={seg.value}
						type="button"
						aria-pressed={isActive}
						disabled={seg.disabled}
						onClick={() => onValueChange(seg.value)}
						className={cn(
							"relative z-10 inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 font-medium whitespace-nowrap transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
							block && "flex-1",
							isActive
								? "text-foreground"
								: "text-muted-foreground hover:text-foreground",
							seg.disabled && !isActive && "hover:text-muted-foreground",
						)}
					>
						{seg.label}
					</button>
				);
			})}
		</div>
	);
}

/**
 * viewTypeSegments - 预置的「网格/表格」视图切换分段
 *
 * 配合 Segmented 组件使用，避免重复定义图标。
 */
export function viewTypeSegments() {
	return [
		{
			value: "grid" as const,
			label: (
				<>
					<LayoutGrid className="size-3.5" />
					网格
				</>
			),
		},
		{
			value: "table" as const,
			label: (
				<>
					<Table className="size-3.5" />
					表格
				</>
			),
		},
	];
}
