"use client";

import { cn } from "cn";
import { Tabs as TabsPrimitive } from "radix-ui";
import type * as React from "react";
import {
	type CSSProperties,
	createContext,
	useCallback,
	useContext,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

/**
 * 底线指示器的几何：主轴起点与长度。
 * 横竖排共用同一组数值，落在哪条轴上由 CSS 按 orientation 决定。
 */
interface IndicatorGeometry {
	offset: number;
	size: number;
}

const TRIGGER_SELECTOR = '[data-slot="tabs-trigger"]';
const ACTIVE_TRIGGER_SELECTOR = `${TRIGGER_SELECTOR}[data-state="active"]`;

/** TabsList 的测量与样式按 orientation 上下文切换主轴。 */
const TabsOrientationContext = createContext<"horizontal" | "vertical">("horizontal");

/** 切换下面一整块平级内容的标签页：←→ 移动并立即切换，Home/End 到首尾。 */
export function Tabs({
	orientation = "horizontal",
	className,
	...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
	return (
		<TabsOrientationContext.Provider value={orientation}>
			<TabsPrimitive.Root
				data-slot="tabs"
				orientation={orientation}
				className={cn("v-tabs", className)}
				{...props}
			/>
		</TabsOrientationContext.Provider>
	);
}

export type TabsProps = React.ComponentProps<typeof TabsPrimitive.Root>;

export interface TabsListProps extends React.ComponentProps<typeof TabsPrimitive.List> {
	/** md：项高 40、字号 14；lg：项高 48、字号 16，页面一级分区用。 */
	size?: "md" | "lg";
}

/**
 * 标签排：当前项下方是共享的墨色 2px 底线，切换时滑到新位置并改变宽度。
 *
 * @remarks
 * 底线位置由测量写入 CSS 变量，首次定位直接落位不过渡；
 * 标签或列表尺寸变化（ResizeObserver、字体就绪）会重新测量；
 * 放不下时横向滚动，两端按滚动位置渐隐，当前项变化时自动滚入可见区。
 */
export function TabsList({
	size = "md",
	className,
	children,
	onScroll,
	ref,
	...props
}: TabsListProps) {
	const orientation = useContext(TabsOrientationContext);
	const vertical = orientation === "vertical";
	const listRef = useRef<HTMLDivElement | null>(null);
	const activeRef = useRef<HTMLElement | null>(null);
	const [geometry, setGeometry] = useState<IndicatorGeometry | null>(null);
	// 首次测量之后才启用滑动，否则底线会从第一项滑进来；SSR 不输出该标记
	const [animated, setAnimated] = useState(false);
	const [overflow, setOverflow] = useState({ start: false, end: false });

	const measure = useCallback(() => {
		const list = listRef.current;
		const active = list?.querySelector<HTMLElement>(ACTIVE_TRIGGER_SELECTOR);
		if (!list || !active) return;
		const next = vertical
			? { offset: active.offsetTop, size: active.offsetHeight }
			: { offset: active.offsetLeft, size: active.offsetWidth };
		setGeometry((prev) =>
			prev && prev.offset === next.offset && prev.size === next.size ? prev : next,
		);
	}, [vertical]);

	const updateOverflow = useCallback(() => {
		const list = listRef.current;
		if (!list) return;
		const max = list.scrollWidth - list.clientWidth;
		const start = list.scrollLeft > 2;
		const end = list.scrollLeft < max - 2;
		setOverflow((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
	}, []);

	const sync = useCallback(() => {
		const list = listRef.current;
		if (!list) return;
		measure();
		updateOverflow();
		const active = list.querySelector<HTMLElement>(ACTIVE_TRIGGER_SELECTOR);
		if (active && active !== activeRef.current) {
			// 初次同步只记录当前项；之后当前项变化才把它滚进可见区
			if (activeRef.current) {
				active.scrollIntoView({ block: "nearest", inline: "nearest" });
			}
			activeRef.current = active;
		}
	}, [measure, updateOverflow]);

	useLayoutEffect(() => {
		const list = listRef.current;
		if (!list) return;
		sync();

		// 单个标签的宽度变化不一定会改变列表总宽（放不下时列表宽被容器钳住），逐项观察
		const resize = new ResizeObserver(sync);
		resize.observe(list);
		for (const trigger of list.querySelectorAll(TRIGGER_SELECTOR)) resize.observe(trigger);

		// Radix 用 data-state 表达激活项；标签增删时补挂观察并重测
		const mutations = new MutationObserver(() => {
			for (const trigger of list.querySelectorAll(TRIGGER_SELECTOR)) resize.observe(trigger);
			sync();
		});
		mutations.observe(list, {
			subtree: true,
			childList: true,
			attributeFilter: ["data-state"],
		});

		// 字体就绪后字形宽度可能变化
		let cancelled = false;
		document.fonts?.ready
			.then(() => {
				if (!cancelled) sync();
			})
			.catch(() => {});

		return () => {
			cancelled = true;
			resize.disconnect();
			mutations.disconnect();
		};
	}, [sync]);

	useEffect(() => {
		if (geometry === null || animated) return;
		let inner = 0;
		const outer = requestAnimationFrame(() => {
			inner = requestAnimationFrame(() => setAnimated(true));
		});
		return () => {
			cancelAnimationFrame(outer);
			cancelAnimationFrame(inner);
		};
	}, [geometry, animated]);

	const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
		onScroll?.(event);
		updateOverflow();
	};

	const setListRef = (node: HTMLDivElement | null) => {
		listRef.current = node;
		if (typeof ref === "function") ref(node);
		else if (ref) ref.current = node;
	};

	const indicatorStyle =
		geometry === null
			? undefined
			: ({
					"--v-tabs-indicator-offset": `${geometry.offset}px`,
					"--v-tabs-indicator-size": `${geometry.size}px`,
				} as CSSProperties);

	return (
		<div
			className="v-tabs__list-wrap"
			data-overflow-start={overflow.start ? "" : undefined}
			data-overflow-end={overflow.end ? "" : undefined}
		>
			<TabsPrimitive.List
				ref={setListRef}
				data-slot="tabs-list"
				data-size={size}
				data-animated={animated ? "" : undefined}
				className={cn("v-tabs__list", className)}
				onScroll={handleScroll}
				{...props}
			>
				{children}
				<span aria-hidden="true" className="v-tabs__indicator" style={indicatorStyle} />
			</TabsPrimitive.List>
			<span aria-hidden="true" className="v-tabs__fade v-tabs__fade--start" />
			<span aria-hidden="true" className="v-tabs__fade v-tabs__fade--end" />
		</div>
	);
}

export type TabsTriggerProps = React.ComponentProps<typeof TabsPrimitive.Trigger>;

/** 单个标签：图标与 {@link TabsCount} 是普通子元素，键盘与激活语义由 Radix 提供。 */
export function TabsTrigger({ className, ...props }: TabsTriggerProps) {
	return (
		<TabsPrimitive.Trigger
			data-slot="tabs-trigger"
			className={cn("v-tabs__tab", className)}
			{...props}
		/>
	);
}

export type TabsCountProps = React.ComponentProps<"span">;

/**
 * 标签旁的小号计数：12px 等宽数字，当前标签的计数加深到墨色 70%。
 * 计数是标签可读名称的一部分（如「评论 12」），不对读屏隐藏。
 */
export function TabsCount({ className, ...props }: TabsCountProps) {
	return <span data-slot="tabs-count" className={cn("v-tabs__count", className)} {...props} />;
}

export type TabsContentProps = React.ComponentProps<typeof TabsPrimitive.Content>;

/**
 * 标签对应的内容面板：可聚焦（Tab 从当前标签直接进入），新内容 180ms 淡入。
 * 未激活面板默认不挂载；forceMount 时保留在 DOM 中但被隐藏。
 */
export function TabsContent({ className, ...props }: TabsContentProps) {
	const panelRef = useRef<HTMLDivElement | null>(null);

	// forceMount 时 Radix 不再补 hidden 属性，这里跟随 data-state 在 DOM 层隐藏未激活面板；
	// CSS 里 [data-state="inactive"] 的 display:none 兜住 MO 回调之前的绘制
	useLayoutEffect(() => {
		const panel = panelRef.current;
		if (!panel) return;
		const apply = () => {
			panel.hidden = panel.getAttribute("data-state") === "inactive";
		};
		apply();
		const mutations = new MutationObserver(apply);
		mutations.observe(panel, { attributeFilter: ["data-state"] });
		return () => mutations.disconnect();
	}, []);

	return (
		<TabsPrimitive.Content
			ref={panelRef}
			data-slot="tabs-panel"
			className={cn("v-tabs__panel", className)}
			{...props}
		/>
	);
}
