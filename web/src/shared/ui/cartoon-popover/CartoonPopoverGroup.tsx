import { cn } from "@shared/lib/utils";
import {
	type CSSProperties,
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import "./cartoon-popover.css";
import { SpeechArrow } from "./CartoonPopover";
import { computePosition } from "./floating";
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
 * 鼠标在同一排触发器间滑过时，共享浮层容器在 X 轴与宽高尺寸间平滑过渡，
 * 小尾巴连续滑动对准当前触发器，内容高度不同时自动拉伸变形。
 */
export function CartoonPopoverGroup({
	sideOffset = 14,
	closeDelay = 180,
	className,
	children,
}: CartoonPopoverGroupProps) {
	const [activeValue, setActiveValue] = useState<string | null>(null);
	const itemsMap = useRef(new Map<string, GroupItemConfig>());
	const closeTimerRef = useRef<number | null>(null);

	const [renderedValue, setRenderedValue] = useState<string | null>(null);
	const [isClosing, setIsClosing] = useState(false);
	const [isMorphing, setIsMorphing] = useState(false);

	const measureRef = useRef<HTMLDivElement | null>(null);
	const floatingRef = useRef<HTMLDivElement | null>(null);

	const [layout, setLayout] = useState<{
		x: number;
		y: number;
		width: number;
		height: number;
		actualSide: CartoonPopoverSide;
		arrowOffset: number;
	} | null>(null);

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
			clearCloseTimer();
			if (activeValue && activeValue !== val) {
				setIsMorphing(true);
			}
			setActiveValue(val);
		},
		[activeValue, clearCloseTimer],
	);

	const handleTriggerLeave = useCallback(() => {
		clearCloseTimer();
		closeTimerRef.current = window.setTimeout(() => {
			setActiveValue(null);
		}, closeDelay);
	}, [clearCloseTimer, closeDelay]);

	useEffect(() => {
		if (activeValue) {
			setRenderedValue(activeValue);
			setIsClosing(false);
		} else if (renderedValue) {
			setIsClosing(true);
			const timer = window.setTimeout(() => {
				setRenderedValue(null);
				setIsClosing(false);
				setIsMorphing(false);
				setLayout(null);
			}, 140);
			return () => window.clearTimeout(timer);
		}
	}, [activeValue, renderedValue]);

	const updateLayout = useCallback(() => {
		if (!activeValue) return;
		const item = itemsMap.current.get(activeValue);
		if (!item?.triggerEl) return;

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

		setLayout({
			x: result.x,
			y: result.y,
			width: contentWidth,
			height: contentHeight,
			actualSide: result.actualSide,
			arrowOffset: result.arrowOffset,
		});
	}, [activeValue, sideOffset]);

	useEffect(() => {
		if (renderedValue) {
			updateLayout();
		}
	}, [renderedValue, updateLayout]);

	useEffect(() => {
		if (!renderedValue) return;
		window.addEventListener("scroll", updateLayout, true);
		window.addEventListener("resize", updateLayout);
		return () => {
			window.removeEventListener("scroll", updateLayout, true);
			window.removeEventListener("resize", updateLayout);
		};
	}, [renderedValue, updateLayout]);

	const currentItem = renderedValue ? itemsMap.current.get(renderedValue) : null;
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
			{renderedValue && currentItem && (
				<div
					ref={measureRef}
					aria-hidden="true"
					className="pointer-events-none fixed -top-[9999px] -left-[9999px] z-0 w-72 rounded-2xl border-2 p-4 text-sm opacity-0"
				>
					{currentItem.title && (
						<h4 className="mb-2 text-sm font-bold tracking-wide">
							{currentItem.title}
						</h4>
					)}
					{currentItem.description && (
						<p className="mb-2 text-xs leading-relaxed text-current/80">
							{currentItem.description}
						</p>
					)}
					{currentItem.contentNode}
				</div>
			)}

			{/* 共享平滑滑动浮层 */}
			{renderedValue &&
				currentItem &&
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
								left: layout ? `${layout.x}px` : "-9999px",
								top: layout ? `${layout.y}px` : "-9999px",
								width: layout ? `${layout.width}px` : "auto",
								height: layout ? `${layout.height}px` : "auto",
								...meta.style,
							} as CSSProperties
						}
						className={cn(
							"relative z-50 overflow-visible rounded-2xl border-2 p-4 text-sm outline-none select-none",
							meta.className,
							shadowClass,
							isMorphing && "cartoon-popover-morphing",
							isClosing ? "cartoon-popover-closing" : "cartoon-popover-enter",
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

						{/* 内容插槽：平滑交叉淡入 */}
						<div key={renderedValue} className="animate-in fade-in-0 duration-150">
							{currentItem.contentNode}
						</div>

						{/* 连续平滑滑动小尾巴 */}
						{currentItem.showArrow !== false && layout && (
							<SpeechArrow
								side={layout.actualSide}
								offset={layout.arrowOffset}
								className={isMorphing ? "cartoon-arrow-morphing" : undefined}
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
