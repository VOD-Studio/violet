import { cn } from "@shared/lib/utils";
import {
	type CSSProperties,
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { SpeechArrow } from "./CartoonPopover";
import { computePosition } from "./floating";
import { useMultiSpring, useSpringValue } from "./spring";
import type {
	CartoonBubbleVariant,
	CartoonPopoverGroupProps,
	CartoonPopoverSide,
	CartoonShadowStyle,
} from "./types";

interface GroupItemConfig {
	value: string;
	triggerEl: HTMLElement | null;
	contentNode: ReactNode;
	title?: ReactNode;
	description?: ReactNode;
	variant?: CartoonBubbleVariant;
	shadowStyle?: CartoonShadowStyle;
	side?: CartoonPopoverSide;
	showArrow?: boolean;
	showShine?: boolean;
}

interface GroupContextValue {
	activeValue: string | null;
	registerItem: (item: GroupItemConfig) => void;
	unregisterItem: (value: string) => void;
	handleTriggerEnter: (value: string) => void;
	handleTriggerLeave: () => void;
}

const GroupContext = createContext<GroupContextValue | null>(null);

const VARIANT_MAP: Record<CartoonBubbleVariant, { className: string; style: CSSProperties }> = {
	default: {
		className: "bg-card text-foreground border-foreground/80 dark:border-foreground/85",
		style: {
			"--cartoon-bg": "var(--card)",
			"--cartoon-border": "var(--foreground)",
			"--cartoon-shadow": "var(--foreground)",
		} as CSSProperties,
	},
	brand: {
		className:
			"bg-[oklch(0.97_0.02_286)] text-[oklch(0.24_0.06_286)] border-brand dark:bg-[oklch(0.22_0.05_286)] dark:text-[oklch(0.96_0.02_286)] dark:border-brand",
		style: {
			"--cartoon-bg": "oklch(0.97 0.02 286)",
			"--cartoon-border": "var(--color-brand, #7c3aed)",
			"--cartoon-shadow": "var(--color-brand, #7c3aed)",
		} as CSSProperties,
	},
	amber: {
		className:
			"bg-amber-50 text-amber-950 border-amber-500 dark:bg-amber-950/70 dark:text-amber-100 dark:border-amber-400",
		style: {
			"--cartoon-bg": "#fffbeb",
			"--cartoon-border": "#f59e0b",
			"--cartoon-shadow": "#d97706",
		} as CSSProperties,
	},
	mint: {
		className:
			"bg-emerald-50 text-emerald-950 border-emerald-500 dark:bg-emerald-950/70 dark:text-emerald-100 dark:border-emerald-400",
		style: {
			"--cartoon-bg": "#ecfdf5",
			"--cartoon-border": "#10b981",
			"--cartoon-shadow": "#059669",
		} as CSSProperties,
	},
	rose: {
		className:
			"bg-rose-50 text-rose-950 border-rose-400 dark:bg-rose-950/70 dark:text-rose-100 dark:border-rose-400",
		style: {
			"--cartoon-bg": "#fff1f2",
			"--cartoon-border": "#fb7185",
			"--cartoon-shadow": "#f43f5e",
		} as CSSProperties,
	},
	sky: {
		className:
			"bg-sky-50 text-sky-950 border-sky-400 dark:bg-sky-950/70 dark:text-sky-100 dark:border-sky-400",
		style: {
			"--cartoon-bg": "#f0f9ff",
			"--cartoon-border": "#38bdf8",
			"--cartoon-shadow": "#0284c7",
		} as CSSProperties,
	},
	dark: {
		className:
			"bg-neutral-900 text-neutral-100 border-neutral-300 dark:bg-neutral-950 dark:text-neutral-50 dark:border-neutral-400",
		style: {
			"--cartoon-bg": "#171717",
			"--cartoon-border": "#d4d4d4",
			"--cartoon-shadow": "#ffffff",
		} as CSSProperties,
	},
};

function getShadowClass(style: CartoonShadowStyle): string {
	return style === "comic"
		? "shadow-[3px_3px_0_0_var(--cartoon-shadow)]"
		: "shadow-[0_4px_24px_rgba(0,0,0,0.06)]";
}

/**
 * 连续平滑移动 Popover 群组：
 * 采用自研物理弹簧驱动（Spring Dynamics）：鼠标在一排触发器间滑过时，
 * 共享浮层容器在 X/Y 轴与宽高尺寸间平滑过渡变形，小尾巴连续追踪当前触发器，
 * 方向翻转时自动自适应，完全不依赖任何第三方动画库。
 */
export function CartoonPopoverGroup({
	sideOffset = 14,
	closeDelay = 180,
	className,
	children,
}: CartoonPopoverGroupProps) {
	const [activeValue, setActiveValue] = useState<string | null>(null);
	const [lastActiveValue, setLastActiveValue] = useState<string | null>(null);
	const itemsMap = useRef(new Map<string, GroupItemConfig>());
	const closeTimerRef = useRef<number | null>(null);

	const measureRef = useRef<HTMLDivElement | null>(null);
	const floatingRef = useRef<HTMLDivElement | null>(null);
	// 下一次目标更新是否应跳过滑行直接落位（浮层从关闭到打开的瞬间）
	const teleportNextRef = useRef(false);

	const clearCloseTimer = useCallback(() => {
		if (closeTimerRef.current !== null) {
			window.clearTimeout(closeTimerRef.current);
			closeTimerRef.current = null;
		}
	}, []);

	const registerItem = useCallback((item: GroupItemConfig) => {
		itemsMap.current.set(item.value, item);
	}, []);

	const unregisterItem = useCallback((val: string) => {
		itemsMap.current.delete(val);
	}, []);

	const handleTriggerEnter = useCallback(
		(val: string) => {
			const wasOpen = activeValue !== null;
			const wasClosing = closeTimerRef.current !== null;
			clearCloseTimer();
			setActiveValue(val);
			setLastActiveValue(val);
			// 浮层未打开或在关闭缓冲中再次进入：请求弹簧 teleport，落位不做滑行
			if (!wasOpen || wasClosing) {
				teleportNextRef.current = true;
			}
		},
		[activeValue, clearCloseTimer],
	);

	const handleTriggerLeave = useCallback(() => {
		clearCloseTimer();
		closeTimerRef.current = window.setTimeout(() => {
			setActiveValue(null);
		}, closeDelay);
	}, [clearCloseTimer, closeDelay]);

	// 计算目标几何物理参数
	const computeTargetLayout = useCallback(() => {
		const targetVal = activeValue ?? lastActiveValue;
		if (!targetVal) return null;
		const item = itemsMap.current.get(targetVal);
		if (!item?.triggerEl) return null;

		const triggerRect = item.triggerEl.getBoundingClientRect();
		const measureEl = measureRef.current;
		let contentWidth = 280;
		let contentHeight = 110;
		if (measureEl) {
			contentWidth = Math.max(220, measureEl.offsetWidth);
			contentHeight = Math.max(50, measureEl.offsetHeight);
		}

		const result = computePosition({
			triggerRect,
			contentWidth,
			contentHeight,
			side: item.side ?? "bottom",
			sideOffset,
			viewportWidth: window.innerWidth,
			viewportHeight: window.innerHeight,
		});

		return {
			x: result.x,
			y: result.y,
			width: contentWidth,
			height: contentHeight,
			actualSide: result.actualSide,
			arrowOffset: result.arrowOffset,
		};
	}, [activeValue, lastActiveValue, sideOffset]);

	const [targetLayout, setTargetLayout] = useState<{
		x: number;
		y: number;
		width: number;
		height: number;
		actualSide: CartoonPopoverSide;
		arrowOffset: number;
	} | null>(null);

	// 主动重算目标几何：供测量节点 layout 后调用，消除首帧高度估算误差
	const triggerRelayout = useCallback(() => {
		setTargetLayout((prev) => {
			const next = computeTargetLayout();
			const same =
				prev &&
				next &&
				prev.x === next.x &&
				prev.y === next.y &&
				prev.width === next.width &&
				prev.height === next.height &&
				prev.arrowOffset === next.arrowOffset &&
				prev.actualSide === next.actualSide;
			return same ? prev : next;
		});
	}, [computeTargetLayout]);

	useEffect(() => {
		triggerRelayout();
	}, [triggerRelayout]);

	// 滚动与视口变化时重算目标位置
	useEffect(() => {
		if (!activeValue) return;
		window.addEventListener("scroll", triggerRelayout, true);
		window.addEventListener("resize", triggerRelayout);
		return () => {
			window.removeEventListener("scroll", triggerRelayout, true);
			window.removeEventListener("resize", triggerRelayout);
		};
	}, [activeValue, triggerRelayout]);

	// 多维物理联合弹簧解算器：驱动浮层在多按钮间平滑滑行与宽高自适应拉伸
	const springGeometry = useMultiSpring(
		targetLayout
			? {
				x: targetLayout.x,
				y: targetLayout.y,
				width: targetLayout.width,
				height: targetLayout.height,
				arrowOffset: targetLayout.arrowOffset,
			}
			: null,
		{
			stiffness: 380,
			damping: 32,
			mass: 0.8,
			precision: 0.2,
		},
		{ teleport: teleportNextRef.current },
	);
	teleportNextRef.current = false;

	// 整体透明度弹簧驱动开合
	const progress = useSpringValue(activeValue ? 1 : 0, {
		stiffness: 420,
		damping: 30,
		mass: 0.8,
		precision: 0.01,
	});

	const isVisible = Boolean(activeValue || progress > 0.01);
	const displayedValue = activeValue ?? lastActiveValue;
	const currentItem = displayedValue ? itemsMap.current.get(displayedValue) : null;
	const variant = currentItem?.variant ?? "default";
	const meta = VARIANT_MAP[variant] ?? VARIANT_MAP.default;
	const shadowClass = getShadowClass(currentItem?.shadowStyle ?? "soft");

	return (
		<GroupContext.Provider
			value={{
				activeValue,
				registerItem,
				unregisterItem,
				handleTriggerEnter,
				handleTriggerLeave,
			}}
		>
			<div
				className={cn("relative inline-flex items-center gap-2", className)}
				onMouseLeave={handleTriggerLeave}
			>
				{children}
			</div>

			{/* 隐藏尺寸测量节点 */}
			{isVisible && currentItem && (
				<MeasureNode
					ref={measureRef}
					onMeasure={triggerRelayout}
					title={currentItem.title}
					description={currentItem.description}
				>
					{currentItem.contentNode}
				</MeasureNode>
			)}

			{/* 物理弹簧驱动的共享平滑滑动浮层 */}
			{isVisible &&
				currentItem &&
				springGeometry &&
				targetLayout &&
				typeof document !== "undefined" &&
				createPortal(
					<div
						ref={floatingRef}
						role="dialog"
						aria-modal="false"
						data-slot="cartoon-popover-content"
						data-variant={variant}
						onMouseEnter={clearCloseTimer}
						onMouseLeave={handleTriggerLeave}
						style={
							{
								position: "fixed",
								left: `${springGeometry.x}px`,
								top: `${springGeometry.y}px`,
								width: `${springGeometry.width}px`,
								height: `${springGeometry.height}px`,
								opacity: progress,
								transform: `scale(${0.96 + 0.04 * progress})`,
								pointerEvents: activeValue ? "auto" : "none",
								...meta.style,
							} as CSSProperties
						}
						className={cn(
							"relative z-50 overflow-visible rounded-2xl border-2 p-4 text-sm outline-none select-none",
							meta.className,
							shadowClass,
						)}
					>
						{/* 漫画气泡微光 */}
						{currentItem.showShine !== false && (
							<span
								aria-hidden="true"
								className="pointer-events-none absolute top-2.5 left-4.5 h-1 w-6 rounded-full bg-white/50 dark:bg-white/15"
							/>
						)}

						{/* 标题 */}
						{currentItem.title && (
							<h4 className="mb-2 text-sm font-bold tracking-wide">
								{currentItem.title}
							</h4>
						)}

						{/* 描述 */}
						{currentItem.description && (
							<p className="mb-2 text-xs leading-relaxed text-current/80">
								{currentItem.description}
							</p>
						)}

						{/* 内容插槽 */}
						<div key={displayedValue} className="animate-in fade-in-0 duration-150">
							{currentItem.contentNode}
						</div>

						{/* 连续平滑滑动小尾巴 */}
						{currentItem.showArrow !== false && (
							<SpeechArrow
								side={targetLayout.actualSide}
								offset={springGeometry.arrowOffset}
							/>
						)}
					</div>,
					document.body,
				)}
		</GroupContext.Provider>
	);
}

/**
 * CartoonPopoverGroupItem 单个群组条目
 */
export interface CartoonPopoverGroupItemProps {
	value: string;
	trigger: ReactNode;
	title?: ReactNode;
	description?: ReactNode;
	variant?: CartoonBubbleVariant;
	shadowStyle?: CartoonShadowStyle;
	side?: CartoonPopoverSide;
	showArrow?: boolean;
	showShine?: boolean;
	children: ReactNode;
}

export function CartoonPopoverGroupItem({
	value,
	trigger,
	title,
	description,
	variant = "default",
	shadowStyle = "soft",
	side = "bottom",
	showArrow = true,
	showShine = true,
	children,
}: CartoonPopoverGroupItemProps) {
	const context = useContext(GroupContext);
	const triggerRef = useRef<HTMLDivElement | null>(null);

	const registerItem = context?.registerItem;
	const unregisterItem = context?.unregisterItem;

	useEffect(() => {
		if (!registerItem) return;
		registerItem({
			value,
			triggerEl: triggerRef.current,
			contentNode: children,
			title,
			description,
			variant,
			shadowStyle,
			side,
			showArrow,
			showShine,
		});
		return () => unregisterItem?.(value);
	}, [
		value,
		children,
		title,
		description,
		variant,
		shadowStyle,
		side,
		showArrow,
		showShine,
		registerItem,
		unregisterItem,
	]);

	return (
		<div
			ref={triggerRef}
			data-popover-item={value}
			className="inline-block"
			onMouseEnter={() => context?.handleTriggerEnter(value)}
			onMouseLeave={() => context?.handleTriggerLeave()}
		>
			{trigger}
		</div>
	);
}

/**
 * 隐藏测量节点：内容挂载后同步触发重测量，供弹簧取到准确的宽高目标。
 */
function MeasureNode({
	ref,
	title,
	description,
	onMeasure,
	children,
}: {
	ref: React.RefObject<HTMLDivElement | null>;
	title?: ReactNode;
	description?: ReactNode;
	onMeasure: () => void;
	children: ReactNode;
}) {
	useLayoutEffect(() => {
		if (!ref.current) return;
		const el = ref.current;
		const last = { w: el.offsetWidth, h: el.offsetHeight };
		onMeasure();
		const observer = new ResizeObserver(() => {
			const w = el.offsetWidth;
			const h = el.offsetHeight;
			if (w !== last.w || h !== last.h) {
				last.w = w;
				last.h = h;
				onMeasure();
			}
		});
		observer.observe(el);
		return () => observer.disconnect();
	});

	return (
		<div
			ref={ref}
			aria-hidden="true"
			className="pointer-events-none fixed -top-[9999px] -left-[9999px] z-0 w-72 rounded-2xl border-2 p-4 text-sm opacity-0"
		>
			{title && <h4 className="mb-2 text-sm font-bold tracking-wide">{title}</h4>}
			{description && (
				<p className="mb-2 text-xs leading-relaxed text-current/80">{description}</p>
			)}
			{children}
		</div>
	);
}
