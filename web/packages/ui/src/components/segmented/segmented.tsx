"use client";

import { cn } from "cn";
import type * as React from "react";
import {
	type CSSProperties,
	Fragment,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

/**
 * `render` 回调拿到的属性，与默认 `<button>` 上展开的是同一份；
 * 自定义元素（路由链接、被 Dropdown 触发器包裹的元素）必须展开它们，指示器与键盘导航依赖其中的数据属性。
 */
export interface SegmentedItemRenderProps {
	className: string;
	children: React.ReactNode;
	title?: string;
	onClick: React.MouseEventHandler<HTMLElement>;
	"data-segment-item": "";
	"data-active": "true" | "false";
	/** 仅有 icon 没有 label 时出现，竖向布局据此居中 */
	"data-icon-only"?: "";
	/** 该项（或整体）被禁用时出现；元素自行决定是否同步原生禁用或 aria-disabled */
	"data-disabled"?: "";
	"aria-disabled"?: true;
	/** 只在默认 button 上出现；链接项用 aria-current 自行表达 */
	"aria-pressed"?: boolean;
	/** 等尺寸布局下携带该项的 --v-segmented-weight；自定义元素必须一并展开 */
	style?: CSSProperties;
}

/**
 * 分段器单项定义
 */
export interface SegmentedItem<V extends string = string> {
	/** 分段值 */
	value: V;
	/** 显示内容（文本或图标） */
	label: React.ReactNode;
	/** 图标；expandSelected 收起时只剩它 */
	icon?: React.ReactNode;
	/** 尾部装饰（如 chevron），收起时同 label 一起折叠 */
	trailing?: React.ReactNode;
	/** 原生 tooltip */
	title?: string;
	/** 是否禁用该段 */
	disabled?: boolean;
	/** 自定义元素，如路由 Link，或被 Dropdown 触发器包裹的元素 */
	render?: (
		props: SegmentedItemRenderProps,
		state: { active: boolean; disabled: boolean },
	) => React.ReactElement;
	/** 需要 itemSize：该项占 itemSize 的倍数宽度，默认 1；放了更多图标的项可适当加宽 */
	weight?: number;
}

export interface SegmentedProps<V extends string = string> {
	/** 当前选中值（受控）；不匹配任何项时无选中，指示器隐藏 */
	value: V;
	/** 值变化回调；链接项靠自身导航时可省略 */
	onValueChange?: (value: V) => void;
	/** 分段列表 */
	segments: SegmentedItem<V>[];
	/** 排布方向，默认 horizontal */
	orientation?: "horizontal" | "vertical";
	/**
	 * soft 是浮在 muted 轨道上的滑块；ink 是实心前景色药丸，轨道底色由使用方给出；
	 * line 无底色，用 2px 墨线标出当前项。默认 soft
	 */
	variant?: "soft" | "ink" | "line";
	/** 尺寸，默认 sm（与按钮高度对齐）；竖向时决定每项的高度 */
	size?: "sm" | "default" | "lg";
	/** 沿主轴撑满容器，各段等分 */
	block?: boolean;
	/** 外轮廓形状，默认 rounded */
	rounded?: "default" | "full";
	/** 整体禁用 */
	disabled?: boolean;
	/**
	 * CSS 长度。设置后进入「等尺寸」布局：每项沿主轴恰为该尺寸，
	 * 指示器几何只由 CSS 变量驱动，不做 JS 测量。
	 */
	itemSize?: string;
	/** expandSelected 时未选中项的主轴尺寸，默认 2.25rem */
	collapsedSize?: string;
	/** 需要 itemSize：选中项占满剩余长度，其余收为只剩 icon，整体主轴总尺寸不变 */
	expandSelected?: boolean;
	"aria-label"?: string;
	/** 自定义类名 */
	className?: string;
	/** 滑块指示器自定义类名 */
	indicatorClassName?: string;
	/** 单项自定义类名 */
	itemClassName?: string;
	/** 激活项自定义类名（如反色高亮 "text-background font-semibold"） */
	activeItemClassName?: string;
	style?: CSSProperties;
	ref?: React.Ref<HTMLDivElement>;
}

interface Geometry {
	/** 激活项沿主轴相对轨道的起点 */
	offset: number;
	/** 激活项主轴尺寸 */
	size: number;
}

const ITEM_SELECTOR = "[data-segment-item]";
const DISABLED_SELECTOR = ":disabled, [data-disabled], [aria-disabled='true']";

/**
 * Segmented - 分段控制器（带滑块平移动画）
 *
 * 受控组件。指示器位移走 transform（合成层），只有尺寸是布局过渡：
 * 默认按激活项的实际 DOM 尺寸测量（各段文字长度不同时仍能精确包裹），
 * 设置 itemSize 后改为纯 CSS 变量驱动，不做任何测量。
 *
 * 方向键在启用项之间移动焦点（不改变选中值，也不改 tab 停靠点）：
 * 横向用 ←/→，竖向用 ↑/↓，Home/End 跳到首尾。
 */
export function Segmented<V extends string = string>({
	value,
	onValueChange,
	segments,
	orientation = "horizontal",
	variant = "soft",
	size = "sm",
	block = false,
	rounded = "default",
	disabled = false,
	itemSize,
	collapsedSize = "2.25rem",
	expandSelected,
	"aria-label": ariaLabel,
	className,
	indicatorClassName,
	itemClassName,
	activeItemClassName,
	style,
	ref,
}: SegmentedProps<V>) {
	const activeIndex = segments.findIndex((s) => s.value === value);
	const vertical = orientation === "vertical";
	const equal = itemSize !== undefined;
	const expanded = equal ? expandSelected : undefined;

	const trackRef = useRef<HTMLDivElement>(null);
	// 仅测量模式使用：激活项的几何。首次测量前指示器隐形，激活项退化为自含底色，
	// 避免 SSR/水合前读不到 DOM 尺寸时出现 0 宽指示器与反色文字隐形。
	const [geometry, setGeometry] = useState<Geometry | null>(null);
	// 首次定位之后才开启滑动过渡，否则指示器会从轨道起点滑进来
	const [animated, setAnimated] = useState(false);
	const measured = geometry !== null;
	const ready = equal || measured;

	const measure = useCallback(() => {
		const active =
			activeIndex < 0
				? null
				: trackRef.current?.querySelector<HTMLElement>(
						`${ITEM_SELECTOR}[data-active="true"]`,
					);
		if (!active) return;
		const offset = vertical ? active.offsetTop : active.offsetLeft;
		const length = vertical ? active.offsetHeight : active.offsetWidth;
		setGeometry((prev) =>
			prev && prev.offset === offset && prev.size === length
				? prev
				: { offset, size: length },
		);
	}, [activeIndex, vertical]);

	// 激活项变化或方向切换时同步重算
	useLayoutEffect(() => {
		if (!equal) measure();
	}, [equal, measure]);

	const itemKeys = segments.map((s) => s.value).join("\u0000");
	// biome-ignore lint/correctness/useExhaustiveDependencies: 条目增减或换值后需重新登记 ResizeObserver 的观察对象
	useEffect(() => {
		const track = trackRef.current;
		if (equal || !track) return;
		const observer = new ResizeObserver(measure);
		observer.observe(track);
		for (const item of track.querySelectorAll(ITEM_SELECTOR)) observer.observe(item);
		// 字体就绪后字形宽度可能变化
		let cancelled = false;
		document.fonts?.ready
			.then(() => {
				if (!cancelled) measure();
			})
			.catch(() => {});
		return () => {
			cancelled = true;
			observer.disconnect();
		};
	}, [equal, measure, itemKeys]);

	useEffect(() => {
		if (!measured || animated) return;
		let inner = 0;
		const outer = requestAnimationFrame(() => {
			inner = requestAnimationFrame(() => setAnimated(true));
		});
		return () => {
			cancelAnimationFrame(outer);
			cancelAnimationFrame(inner);
		};
	}, [measured, animated]);

	const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
		const [prevKey, nextKey] = vertical
			? ["ArrowUp", "ArrowDown"]
			: ["ArrowLeft", "ArrowRight"];
		if (![prevKey, nextKey, "Home", "End"].includes(event.key)) return;

		const items = Array.from(
			event.currentTarget.querySelectorAll<HTMLElement>(ITEM_SELECTOR),
		).filter((item) => !item.matches(DISABLED_SELECTOR));
		const current = items.findIndex(
			(item) => item === event.target || item.contains(event.target as Node),
		);
		if (current < 0) return;

		let next = current;
		if (event.key === nextKey) next = (current + 1) % items.length;
		else if (event.key === prevKey) next = (current - 1 + items.length) % items.length;
		else if (event.key === "Home") next = 0;
		else next = items.length - 1;

		event.preventDefault();
		items[next]?.focus();
	};

	const indicatorStyle: CSSProperties | undefined =
		!equal && geometry
			? vertical
				? { transform: `translate3d(0, ${geometry.offset}px, 0)`, height: geometry.size }
				: { transform: `translate3d(${geometry.offset}px, 0, 0)`, width: geometry.size }
			: undefined;

	const weights = segments.map((s) => s.weight ?? 1);
	const containerStyle = equal
		? ({
				"--v-segmented-item-size": itemSize,
				"--v-segmented-collapsed-size": collapsedSize,
				"--v-segmented-count": segments.length,
				"--v-segmented-index": Math.max(activeIndex, 0),
				"--v-segmented-total": weights.reduce((sum, w) => sum + w, 0),
				"--v-segmented-offset": weights
					.slice(0, Math.max(activeIndex, 0))
					.reduce((sum, w) => sum + w, 0),
				"--v-segmented-active-weight": weights[activeIndex] ?? 1,
				...style,
			} as CSSProperties)
		: style;

	return (
		<div
			ref={ref}
			data-slot="segmented"
			{...(ariaLabel ? { role: "group", "aria-label": ariaLabel } : {})}
			data-orientation={orientation}
			data-variant={variant}
			data-size={size}
			data-rounded={rounded}
			data-block={block ? "true" : "false"}
			data-layout={equal ? "equal" : undefined}
			data-expanded={expanded === undefined ? undefined : expanded ? "true" : "false"}
			data-has-active={activeIndex >= 0 ? "true" : "false"}
			data-measured={equal ? undefined : measured ? "true" : "false"}
			data-animated={animated ? "true" : undefined}
			data-disabled={disabled ? "" : undefined}
			className={cn("v-segmented", className)}
			style={containerStyle}
		>
			<div ref={trackRef} className="v-segmented__track" onKeyDown={handleKeyDown}>
				<span
					aria-hidden="true"
					className={cn("v-segmented__indicator", indicatorClassName)}
					style={indicatorStyle}
				/>
				{segments.map((seg, i) => {
					const active = i === activeIndex;
					const itemDisabled = disabled || seg.disabled === true;
					const labelled = seg.label != null && seg.label !== false && seg.label !== "";
					const composed = equal || seg.icon != null || seg.trailing != null;
					const weight = seg.weight ?? 1;

					const props: SegmentedItemRenderProps = {
						className: cn(
							"v-segmented__item",
							itemClassName,
							active && ready && activeItemClassName,
						),
						children: composed ? (
							<>
								{seg.icon}
								{labelled && (
									<span
										key={typeof seg.label === "string" ? seg.label : undefined}
										className="v-segmented__label"
									>
										{seg.label}
									</span>
								)}
								{seg.trailing != null && (
									<span className="v-segmented__trailing">{seg.trailing}</span>
								)}
							</>
						) : (
							seg.label
						),
						title: seg.title,
						onClick: () => {
							if (!itemDisabled) onValueChange?.(seg.value);
						},
						"data-segment-item": "",
						"data-active": active ? "true" : "false",
						"data-icon-only": seg.icon != null && !labelled ? "" : undefined,
						style:
							equal && weight !== 1
								? ({ "--v-segmented-weight": weight } as CSSProperties)
								: undefined,
					};

					if (seg.render) {
						return (
							<Fragment key={seg.value}>
								{seg.render(
									{
										...props,
										"data-disabled": itemDisabled ? "" : undefined,
										"aria-disabled": itemDisabled ? true : undefined,
									},
									{ active, disabled: itemDisabled },
								)}
							</Fragment>
						);
					}

					return (
						<button
							key={seg.value}
							{...props}
							type="button"
							aria-pressed={active}
							disabled={itemDisabled}
						/>
					);
				})}
			</div>
		</div>
	);
}
