import { cn } from "@shared/lib/utils";
import { X } from "lucide-react";
import {
	Children,
	type CSSProperties,
	cloneElement,
	createContext,
	isValidElement,
	type ReactElement,
	useCallback,
	useContext,
	useEffect,
	useId,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import "./cartoon-popover.css";
import { computePosition } from "./floating";
import type {
	CartoonAnimationType,
	CartoonBubbleStyle,
	CartoonBubbleVariant,
	CartoonPopoverCloseProps,
	CartoonPopoverContentProps,
	CartoonPopoverContextValue,
	CartoonPopoverDescriptionProps,
	CartoonPopoverHeaderProps,
	CartoonPopoverProps,
	CartoonPopoverSide,
	CartoonPopoverTitleProps,
	CartoonPopoverTriggerProps,
	CartoonShadowStyle,
	CartoonTriggerMode,
} from "./types";

const CartoonPopoverContext = createContext<CartoonPopoverContextValue | null>(null);

function useCartoonPopover() {
	const context = useContext(CartoonPopoverContext);
	if (!context) {
		throw new Error("CartoonPopover 子组件必须包裹在 <CartoonPopover> 内使用。");
	}
	return context;
}

/**
 * 变体对应的样式和 CSS 变量映射。
 */
interface VariantMeta {
	className: string;
	style: CSSProperties;
}

const VARIANT_MAP: Record<CartoonBubbleVariant, VariantMeta> = {
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

/**
 * 投影样式映射。
 */
function getShadowClass(style: CartoonShadowStyle): string {
	if (style === "comic") {
		return "shadow-[3px_3px_0_0_var(--cartoon-shadow)]";
	}
	return "shadow-[0_4px_24px_rgba(0,0,0,0.06)]";
}

/**
 * 获取动画样式类名。
 */
function getAnimationClass(anim: CartoonAnimationType, closing: boolean): string {
	if (closing) {
		return "cartoon-popover-closing";
	}
	switch (anim) {
		case "bounce":
			return "cartoon-popover-anim-bounce";
		case "fade":
			return "cartoon-popover-anim-fade";
		default:
			return "cartoon-popover-anim-jelly";
	}
}

/**
 * CartoonPopover 根组件，维护弹层开闭状态与触发器引用，支持点击与悬停。
 */
export function CartoonPopover({
	open: controlledOpen,
	defaultOpen = false,
	onOpenChange,
	triggerMode: customTriggerMode,
	openOnHover = false,
	hoverDelay = 80,
	closeDelay = 150,
	children,
}: CartoonPopoverProps) {
	const triggerMode: CartoonTriggerMode = openOnHover ? "both" : (customTriggerMode ?? "click");

	const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
	const isControlled = controlledOpen !== undefined;
	const open = isControlled ? controlledOpen : uncontrolledOpen;

	const triggerRef = useRef<HTMLElement | null>(null);
	const contentRef = useRef<HTMLDivElement | null>(null);
	const popoverId = useId();

	const openTimerRef = useRef<number | null>(null);
	const closeTimerRef = useRef<number | null>(null);

	const clearTimers = useCallback(() => {
		if (openTimerRef.current !== null) {
			window.clearTimeout(openTimerRef.current);
			openTimerRef.current = null;
		}
		if (closeTimerRef.current !== null) {
			window.clearTimeout(closeTimerRef.current);
			closeTimerRef.current = null;
		}
	}, []);

	const setOpen = useCallback(
		(nextOpen: boolean) => {
			clearTimers();
			if (!isControlled) {
				setUncontrolledOpen(nextOpen);
			}
			onOpenChange?.(nextOpen);
		},
		[clearTimers, isControlled, onOpenChange],
	);

	const handleMouseEnter = useCallback(() => {
		if (triggerMode === "click") return;
		clearTimers();
		openTimerRef.current = window.setTimeout(() => {
			if (!isControlled) setUncontrolledOpen(true);
			onOpenChange?.(true);
		}, hoverDelay);
	}, [triggerMode, clearTimers, hoverDelay, isControlled, onOpenChange]);

	const handleMouseLeave = useCallback(() => {
		if (triggerMode === "click") return;
		clearTimers();
		closeTimerRef.current = window.setTimeout(() => {
			if (!isControlled) setUncontrolledOpen(false);
			onOpenChange?.(false);
		}, closeDelay);
	}, [triggerMode, clearTimers, closeDelay, isControlled, onOpenChange]);

	useEffect(() => {
		return () => clearTimers();
	}, [clearTimers]);

	return (
		<CartoonPopoverContext.Provider
			value={{
				open,
				setOpen,
				triggerRef,
				contentRef,
				popoverId,
				triggerMode,
				hoverDelay,
				closeDelay,
				handleMouseEnter,
				handleMouseLeave,
			}}
		>
			{children}
		</CartoonPopoverContext.Provider>
	);
}

/**
 * CartoonPopover 触发器组件，支持点击与悬停事件。
 */
export function CartoonPopoverTrigger({
	asChild = false,
	children,
	onClick,
	onMouseEnter,
	onMouseLeave,
	className,
	...props
}: CartoonPopoverTriggerProps) {
	const {
		open,
		setOpen,
		triggerRef,
		popoverId,
		triggerMode,
		handleMouseEnter,
		handleMouseLeave,
	} = useCartoonPopover();

	const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
		onClick?.(e);
		if (!e.defaultPrevented && (triggerMode === "click" || triggerMode === "both")) {
			setOpen(!open);
		}
	};

	if (asChild && isValidElement(children)) {
		type TriggerChildProps = React.HTMLAttributes<HTMLElement> & {
			onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
			onMouseEnter?: (e: React.MouseEvent<HTMLElement>) => void;
			onMouseLeave?: (e: React.MouseEvent<HTMLElement>) => void;
			ref?: React.Ref<HTMLElement>;
			"data-state"?: string;
		};
		const child = Children.only(children) as ReactElement<TriggerChildProps>;
		const existingRef = child.props.ref;

		return cloneElement(child, {
			onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
				child.props.onClick?.(e);
				handleClick(e);
			},
			onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
				child.props.onMouseEnter?.(e);
				onMouseEnter?.(e as React.MouseEvent<HTMLButtonElement>);
				handleMouseEnter();
			},
			onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
				child.props.onMouseLeave?.(e);
				onMouseLeave?.(e as React.MouseEvent<HTMLButtonElement>);
				handleMouseLeave();
			},
			ref: (node: HTMLElement | null) => {
				triggerRef.current = node;
				if (typeof existingRef === "function") {
					existingRef(node);
				} else if (
					existingRef &&
					typeof existingRef === "object" &&
					"current" in existingRef
				) {
					existingRef.current = node;
				}
			},
			"aria-haspopup": "dialog",
			"aria-expanded": open,
			"aria-controls": popoverId,
			"data-state": open ? "open" : "closed",
		});
	}

	return (
		<button
			type="button"
			ref={(node) => {
				triggerRef.current = node;
			}}
			onClick={handleClick}
			onMouseEnter={(e) => {
				onMouseEnter?.(e);
				handleMouseEnter();
			}}
			onMouseLeave={(e) => {
				onMouseLeave?.(e);
				handleMouseLeave();
			}}
			aria-haspopup="dialog"
			aria-expanded={open}
			aria-controls={popoverId}
			data-state={open ? "open" : "closed"}
			className={className}
			{...props}
		>
			{children}
		</button>
	);
}

/**
 * 卡通小尾巴（Arrow / Tail）纯手写 SVG 遮罩连通实现。
 *
 * 采用遮罩填充（Overlap Mask）技术：在气泡边框相接处覆盖一块背景填充矩形，
 * 消除气泡自身的 2px 边框阻隔，并让两侧 2px 漫画斜边精准焊接入气泡轮廓，
 * 彻底消除黑线阻断与悬空缝隙。
 */
interface SpeechArrowProps {
	side: CartoonPopoverSide;
	offset: number;
	bubbleStyle: CartoonBubbleStyle;
}

function SpeechArrow({ side, offset, bubbleStyle }: SpeechArrowProps) {
	if (bubbleStyle === "thought") {
		// 思考气泡：双级小圆点依次阶梯延伸，总高度紧凑不穿模
		let containerStyle: CSSProperties = {};
		if (side === "bottom") {
			containerStyle = { top: "-10px", left: `${offset - 6}px` };
		} else if (side === "top") {
			containerStyle = { bottom: "-10px", left: `${offset - 6}px` };
		} else if (side === "right") {
			containerStyle = { left: "-10px", top: `${offset - 6}px` };
		} else {
			containerStyle = { right: "-10px", top: `${offset - 6}px` };
		}

		return (
			<div
				className="pointer-events-none absolute flex items-center justify-center"
				style={containerStyle}
				aria-hidden="true"
			>
				<svg
					width="12"
					height="12"
					viewBox="0 0 12 12"
					className="overflow-visible"
					aria-hidden="true"
				>
					<circle
						cx="6"
						cy="4"
						r="3.5"
						className="thought-bubble-dot-1"
						style={{ fill: "var(--cartoon-bg)", stroke: "var(--cartoon-border)" }}
						strokeWidth="2"
					/>
					<circle
						cx="6"
						cy="9.5"
						r="2"
						className="thought-bubble-dot-2"
						style={{ fill: "var(--cartoon-bg)", stroke: "var(--cartoon-border)" }}
						strokeWidth="1.5"
					/>
				</svg>
			</div>
		);
	}

	// 经典对白三角形尾巴：外露 8px，宽 16px，底部 3px 深入气泡内部覆盖消除 2px 边框线
	const W = 16;
	const H = 8;
	const D = 3;
	const totalH = H + D; // 11px

	let arrowStyle: CSSProperties = {};
	let pathFill = "";
	let pathStroke = "";

	if (side === "bottom") {
		// 气泡在下方，尾巴在顶部朝上，定位在 top: -8px
		arrowStyle = {
			top: `-${H}px`,
			left: `${offset - W / 2}px`,
		};
		// 多边形：尖角 (8, 0)，底边矩形伸到 y = 11，遮盖气泡顶边 2px 边框
		pathFill = `M 0 ${H} L ${W / 2} 0 L ${W} ${H} L ${W} ${totalH} L 0 ${totalH} Z`;
		// 斜边描线：从 (0, 8) 到 (8, 0) 再到 (16, 8)，起点终点精准压在气泡顶边线上
		pathStroke = `M 0 ${H} L ${W / 2} 0 L ${W} ${H}`;
	} else if (side === "top") {
		// 气泡在上方，尾巴在底部朝下，定位在 bottom: -8px
		arrowStyle = {
			bottom: `-${H}px`,
			left: `${offset - W / 2}px`,
		};
		// 多边形：尖角 (8, 11)，顶边矩形伸到 y = 0
		pathFill = `M 0 ${D} L ${W} ${D} L ${W} 0 L 0 0 Z M 0 ${D} L ${W / 2} ${totalH} L ${W} ${D} Z`;
		pathStroke = `M 0 ${D} L ${W / 2} ${totalH} L ${W} ${D}`;
	} else if (side === "right") {
		// 气泡在右侧，尾巴在左侧朝左，定位在 left: -8px
		arrowStyle = {
			left: `-${H}px`,
			top: `${offset - W / 2}px`,
		};
		pathFill = `M ${H} 0 L 0 ${W / 2} L ${H} ${W} L ${totalH} ${W} L ${totalH} 0 Z`;
		pathStroke = `M ${H} 0 L 0 ${W / 2} L ${H} ${W}`;
	} else {
		// 气泡在左侧，尾巴在右侧朝右，定位在 right: -8px
		arrowStyle = {
			right: `-${H}px`,
			top: `${offset - W / 2}px`,
		};
		pathFill = `M ${D} 0 L ${totalH} ${W / 2} L ${D} ${W} L 0 ${W} L 0 0 Z`;
		pathStroke = `M ${D} 0 L ${totalH} ${W / 2} L ${D} ${W}`;
	}

	const isHorizontal = side === "left" || side === "right";
	const svgW = isHorizontal ? totalH : W;
	const svgH = isHorizontal ? W : totalH;

	return (
		<div
			className="pointer-events-none absolute z-10 overflow-visible"
			style={arrowStyle}
			aria-hidden="true"
		>
			<svg
				width={svgW}
				height={svgH}
				viewBox={`0 0 ${svgW} ${svgH}`}
				className="overflow-visible"
				aria-hidden="true"
			>
				{/* 背景遮罩层：抹除气泡边框并连通气泡内部 */}
				<path d={pathFill} style={{ fill: "var(--cartoon-bg)" }} />
				{/* 2px 漫画圆润斜边描线 */}
				<path
					d={pathStroke}
					fill="none"
					style={{ stroke: "var(--cartoon-border)" }}
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
		</div>
	);
}

/**
 * CartoonPopoverContent 气泡浮层主体。
 */
export function CartoonPopoverContent({
	side = "bottom",
	align = "center",
	sideOffset = 12,
	collisionPadding = 8,
	bubbleStyle = "speech",
	variant = "default",
	shadowStyle = "soft",
	animation = "jelly",
	showArrow = true,
	showShine = true,
	title,
	description,
	showClose = false,
	container,
	className,
	style,
	children,
	onMouseEnter,
	onMouseLeave,
	...props
}: CartoonPopoverContentProps) {
	const { open, setOpen, triggerRef, contentRef, popoverId, handleMouseEnter, handleMouseLeave } =
		useCartoonPopover();

	const [rendered, setRendered] = useState(open);
	const [isClosing, setIsClosing] = useState(false);
	const [coords, setCoords] = useState<{
		x: number;
		y: number;
		actualSide: CartoonPopoverSide;
		arrowOffset: number;
		transformOrigin: string;
	} | null>(null);

	// 退出动画过渡管理
	useEffect(() => {
		if (open) {
			setRendered(true);
			setIsClosing(false);
		} else if (rendered) {
			setIsClosing(true);
			const timer = setTimeout(() => {
				setRendered(false);
				setIsClosing(false);
			}, 160);
			return () => clearTimeout(timer);
		}
	}, [open, rendered]);

	// 计算绝对定位坐标与箭头偏移
	const updatePosition = useCallback(() => {
		const triggerEl = triggerRef.current;
		const contentEl = contentRef.current;
		if (!triggerEl || !contentEl) return;

		const triggerRect = triggerEl.getBoundingClientRect();
		// 使用 offsetWidth/Height 避免 CSS transform scale 动画影响尺寸测量
		const contentWidth = contentEl.offsetWidth;
		const contentHeight = contentEl.offsetHeight;

		const result = computePosition({
			triggerRect,
			contentWidth,
			contentHeight,
			side,
			align,
			sideOffset,
			collisionPadding,
			viewportWidth: window.innerWidth,
			viewportHeight: window.innerHeight,
		});

		setCoords({
			x: result.x,
			y: result.y,
			actualSide: result.actualSide,
			arrowOffset: result.arrowOffset,
			transformOrigin: result.transformOrigin,
		});
	}, [side, align, sideOffset, collisionPadding, triggerRef, contentRef]);

	// 打开时或视口滚动/变化时重新定位
	useEffect(() => {
		if (!rendered) return;
		updatePosition();

		window.addEventListener("scroll", updatePosition, true);
		window.addEventListener("resize", updatePosition);

		return () => {
			window.removeEventListener("scroll", updatePosition, true);
			window.removeEventListener("resize", updatePosition);
		};
	}, [rendered, updatePosition]);

	// 点击外部关闭与 Escape 键关闭
	useEffect(() => {
		if (!open) return;

		const handlePointerDown = (e: MouseEvent | TouchEvent) => {
			const target = e.target as Node | null;
			if (!target) return;
			const isInsideTrigger = triggerRef.current?.contains(target);
			const isInsideContent = contentRef.current?.contains(target);
			if (!isInsideTrigger && !isInsideContent) {
				setOpen(false);
			}
		};

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				setOpen(false);
			}
		};

		document.addEventListener("mousedown", handlePointerDown);
		document.addEventListener("touchstart", handlePointerDown);
		document.addEventListener("keydown", handleKeyDown);

		return () => {
			document.removeEventListener("mousedown", handlePointerDown);
			document.removeEventListener("touchstart", handlePointerDown);
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [open, setOpen, triggerRef, contentRef]);

	if (!rendered) {
		return null;
	}

	const meta = VARIANT_MAP[variant] ?? VARIANT_MAP.default;
	const shadowClass = getShadowClass(shadowStyle);
	const animClass = getAnimationClass(animation, isClosing);
	const hasHeader = Boolean(title || showClose);
	const targetContainer = container ?? (typeof document !== "undefined" ? document.body : null);

	if (!targetContainer) return null;

	const contentNode = (
		<div
			ref={(node) => {
				contentRef.current = node;
				if (node && !coords) {
					// 挂载初次立即计算位置
					updatePosition();
				}
			}}
			id={popoverId}
			role="dialog"
			aria-modal="false"
			data-slot="cartoon-popover-content"
			data-variant={variant}
			data-bubble-style={bubbleStyle}
			data-side={coords?.actualSide ?? side}
			onMouseEnter={(e) => {
				onMouseEnter?.(e);
				handleMouseEnter();
			}}
			onMouseLeave={(e) => {
				onMouseLeave?.(e);
				handleMouseLeave();
			}}
			style={
				{
					position: "fixed",
					left: coords ? `${coords.x}px` : "-9999px",
					top: coords ? `${coords.y}px` : "-9999px",
					"--cartoon-origin": coords?.transformOrigin ?? "center",
					...meta.style,
					...style,
				} as CSSProperties
			}
			className={cn(
				"relative z-50 w-72 rounded-2xl border-2 p-4 text-sm outline-none select-none",
				meta.className,
				shadowClass,
				animClass,
				className,
			)}
			{...props}
		>
			{/* 卡通气泡顶部微光条 */}
			{showShine && (
				<span
					aria-hidden="true"
					className="pointer-events-none absolute top-2.5 left-4.5 h-1 w-6 rounded-full bg-white/50 dark:bg-white/15"
				/>
			)}

			{/* 可选快捷头部 */}
			{hasHeader && (
				<CartoonPopoverHeader>
					{title ? (
						typeof title === "string" ? (
							<CartoonPopoverTitle>{title}</CartoonPopoverTitle>
						) : (
							title
						)
					) : (
						<div />
					)}
					{showClose && <CartoonPopoverClose />}
				</CartoonPopoverHeader>
			)}

			{/* 可选描述 */}
			{description && (
				<div className="mb-2">
					{typeof description === "string" ? (
						<CartoonPopoverDescription>{description}</CartoonPopoverDescription>
					) : (
						description
					)}
				</div>
			)}

			{/* 主内容插槽 */}
			{children}

			{/* 气泡小尾巴 */}
			{showArrow && bubbleStyle !== "sticker" && coords && (
				<SpeechArrow
					side={coords.actualSide}
					offset={coords.arrowOffset}
					bubbleStyle={bubbleStyle}
				/>
			)}
		</div>
	);

	return createPortal(contentNode, targetContainer);
}

/**
 * CartoonPopoverHeader 头部容器（带卡通虚线底边分隔）。
 */
export function CartoonPopoverHeader({ className, children, ...props }: CartoonPopoverHeaderProps) {
	return (
		<div
			className={cn(
				"mb-2.5 flex items-center justify-between gap-3 border-b-2 border-dashed border-current/15 pb-2",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}

/**
 * CartoonPopoverTitle 标题。
 */
export function CartoonPopoverTitle({ className, children, ...props }: CartoonPopoverTitleProps) {
	return (
		<h4
			className={cn("flex items-center gap-1.5 text-sm font-bold tracking-wide", className)}
			{...props}
		>
			{children}
		</h4>
	);
}

/**
 * CartoonPopoverDescription 描述段落。
 */
export function CartoonPopoverDescription({
	className,
	children,
	...props
}: CartoonPopoverDescriptionProps) {
	return (
		<p className={cn("text-xs leading-relaxed text-current/80", className)} {...props}>
			{children}
		</p>
	);
}

/**
 * CartoonPopoverClose 关闭按钮（卡通圆形胶囊）。
 */
export function CartoonPopoverClose({ className, onClick, ...props }: CartoonPopoverCloseProps) {
	const { setOpen } = useCartoonPopover();

	return (
		<button
			type="button"
			aria-label="关闭"
			onClick={(e) => {
				onClick?.(e);
				if (!e.defaultPrevented) {
					setOpen(false);
				}
			}}
			className={cn(
				"inline-flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-current/80 bg-background text-foreground/80 shadow-[1px_1px_0_0_currentColor] transition-all duration-200",
				"hover:rotate-90 hover:scale-110 hover:border-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/70 dark:hover:border-rose-400 dark:hover:text-rose-400",
				"active:scale-90 active:rotate-45",
				className,
			)}
			{...props}
		>
			<X className="size-3.5 stroke-[2.8]" />
		</button>
	);
}
