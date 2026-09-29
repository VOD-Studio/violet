import { useReducedMotion } from "@shared/lib/motion";
import { cn } from "cn";
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
import { BubbleOutline } from "./BubbleOutline";
import { computePosition } from "./floating";
import { useMultiSpring, useSpringValue } from "./spring";
import type {
	CartoonBubbleVariant,
	CartoonPopoverGroupProps,
	CartoonPopoverSide,
	CartoonShadowStyle,
} from "./types";
import { darkContentOpacity, getShadowClass, VARIANT_MAP } from "./variants";

interface GroupItemConfig {
	value: string;
	triggerEl: HTMLElement | null;
	contentNode: ReactNode;
	ariaLabel?: string;
	title?: ReactNode;
	description?: ReactNode;
	variant?: CartoonBubbleVariant;
	shadowStyle?: CartoonShadowStyle;
	side?: CartoonPopoverSide;
	showArrow?: boolean;
	showShine?: boolean;
}

interface GroupLayout {
	x: number;
	y: number;
	width: number;
	height: number;
	actualSide: CartoonPopoverSide;
	arrowOffset: number;
}

interface GroupContextValue {
	activeValue: string | null;
	registerItem: (item: GroupItemConfig) => void;
	unregisterItem: (value: string) => void;
	handleTriggerEnter: (value: string) => void;
	handleTriggerLeave: () => void;
}

const GroupContext = createContext<GroupContextValue | null>(null);

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
	const [targetLayout, setTargetLayout] = useState<GroupLayout | null>(null);
	const teleportNextRef = useRef(false);
	const itemsMap = useRef(new Map<string, GroupItemConfig>());
	const closeTimerRef = useRef<number | null>(null);

	const reduceMotion = useReducedMotion();
	// 多维物理联合弹簧解算器：驱动浮层在多按钮间平滑滑行与宽高自适应拉伸
	const shouldTeleport = teleportNextRef.current && targetLayout !== null;
	const [springGeometry, resetSpring] = useMultiSpring(
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
		{ teleport: shouldTeleport || reduceMotion },
	);
	if (shouldTeleport) {
		teleportNextRef.current = false;
	}

	const measureRef = useRef<HTMLDivElement | null>(null);
	const floatingRef = useRef<HTMLDivElement | null>(null);

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
			clearCloseTimer();
			if (!wasOpen) {
				// 完全关闭后重新打开：丢弃旧坐标并清空弹簧，
				// 浮层在测量出新布局前保持卸载，重挂载即在新位置，无旧位置滑入。
				setTargetLayout(null);
				teleportNextRef.current = true;
				resetSpring();
			}
			setActiveValue(val);
			setLastActiveValue(val);
		},
		[activeValue, clearCloseTimer, resetSpring],
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
		// 尾巴与圆角需留安全边距；超过 80px 后由内容自然决定宽度。
		let contentWidth = 80;
		let contentHeight = 110;
		if (measureEl) {
			const { width, height } = measureEl.getBoundingClientRect();
			contentWidth = Math.max(80, width);
			contentHeight = Math.max(50, height);
		}

		const result = computePosition({
			triggerRect,
			contentWidth,
			contentHeight,
			side: item.side ?? "bottom",
			sideOffset,
			collisionPadding: 16,
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

	// 主动重算目标几何：供测量节点 layout 后调用，消除首帧高度估算误差
	const triggerRelayout = useCallback(() => {
		const next = computeTargetLayout();
		setTargetLayout((prev) => {
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

	const progress = useSpringValue(
		activeValue ? 1 : 0,
		{ stiffness: 360, damping: 38, mass: 0.8, precision: 0.01 },
		{ instant: reduceMotion },
	);
	const ink = Math.max(0, Math.min(1, progress));
	const isVisible = Boolean(activeValue || ink > 0.01);
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
						aria-label={currentItem.ariaLabel}
						aria-modal="false"
						aria-hidden={!activeValue}
						inert={!activeValue}
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
								opacity: ink,
								borderColor: "transparent",
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
						<BubbleOutline
							width={springGeometry.width}
							height={springGeometry.height}
							side={targetLayout.actualSide}
							arrowOffset={springGeometry.arrowOffset}
							showArrow={currentItem.showArrow !== false}
							progress={ink}
						/>
						{/* 漫画气泡微光 */}
						{currentItem.showShine !== false && (
							<span
								aria-hidden="true"
								className={cn(
									"pointer-events-none absolute top-2.5 left-4.5 h-1 w-6 rounded-full",
									variant === "dark"
										? "bg-violet-200/30"
										: "bg-white/50 dark:bg-white/15",
								)}
							/>
						)}

						{/* 内容按目标尺寸排布：弹簧过渡只裁切可视范围，避免中间宽度下文字重排跳动 */}
						<div className="overflow-hidden" style={{ width: targetLayout.width - 36 }}>
							<div
								key={displayedValue}
								style={
									variant === "dark" && !reduceMotion
										? { opacity: darkContentOpacity(ink) }
										: undefined
								}
							>
								<div
									className={
										variant === "dark" && !reduceMotion
											? "animate-in fade-in-0 duration-200"
											: undefined
									}
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
									<div
										className={
											variant !== "dark" && !reduceMotion
												? "animate-in fade-in-0 duration-150"
												: undefined
										}
									>
										{currentItem.contentNode}
									</div>
								</div>
							</div>
						</div>
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
	ariaLabel?: string;
	className?: string;
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
	ariaLabel,
	className,
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
			ariaLabel,
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
		ariaLabel,
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
			className={cn("inline-block", className)}
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
		let { width: lastWidth, height: lastHeight } = el.getBoundingClientRect();
		onMeasure();
		const observer = new ResizeObserver(() => {
			const { width, height } = el.getBoundingClientRect();
			if (width !== lastWidth || height !== lastHeight) {
				lastWidth = width;
				lastHeight = height;
				onMeasure();
			}
		});
		observer.observe(el);
		return () => observer.disconnect();
	}, [onMeasure, ref]);

	return (
		<div
			ref={ref}
			aria-hidden="true"
			className="pointer-events-none fixed -top-[9999px] -left-[9999px] z-0 min-w-20 w-max rounded-2xl border-2 p-4 text-sm opacity-0"
		>
			{title && <h4 className="mb-2 text-sm font-bold tracking-wide">{title}</h4>}
			{description && (
				<p className="mb-2 text-xs leading-relaxed text-current/80">{description}</p>
			)}
			{children}
		</div>
	);
}
