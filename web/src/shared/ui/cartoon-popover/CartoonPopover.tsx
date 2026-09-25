import { useReducedMotion } from "@shared/lib/motion";
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
import { BubbleOutline } from "./BubbleOutline";
import { computePosition } from "./floating";
import { useSpringValue } from "./spring";
import type {
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
	showArrow = true,
	showShine = true,
	title,
	description,
	divided = false,
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

	const [coords, setCoords] = useState<{
		x: number;
		y: number;
		width: number;
		height: number;
		actualSide: CartoonPopoverSide;
		arrowOffset: number;
	} | null>(null);

	const reduceMotion = useReducedMotion();
	const progress = useSpringValue(
		open ? 1 : 0,
		{ stiffness: 360, damping: 38, mass: 0.8, precision: 0.01 },
		{ instant: reduceMotion },
	);
	const ink = Math.max(0, Math.min(1, progress));
	const updatePosition = useCallback(() => {
		const triggerEl = triggerRef.current;
		const contentEl = contentRef.current;
		if (!triggerEl || !contentEl) return;

		const triggerRect = triggerEl.getBoundingClientRect();
		// offsetWidth/Height 不受开合透明度影响。
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
			width: contentWidth,
			height: contentHeight,
			actualSide: result.actualSide,
			arrowOffset: result.arrowOffset,
		});
	}, [side, align, sideOffset, collisionPadding, triggerRef, contentRef]);

	// 打开时或视口滚动/变化时重新定位
	useEffect(() => {
		if (!open) return;
		updatePosition();
		const contentEl = contentRef.current;
		const observer =
			contentEl && typeof ResizeObserver !== "undefined"
				? new ResizeObserver(updatePosition)
				: null;
		if (observer && contentEl) observer.observe(contentEl);

		window.addEventListener("scroll", updatePosition, true);
		window.addEventListener("resize", updatePosition);

		return () => {
			window.removeEventListener("scroll", updatePosition, true);
			window.removeEventListener("resize", updatePosition);
			observer?.disconnect();
		};
	}, [open, updatePosition, contentRef]);

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

	const meta = VARIANT_MAP[variant] ?? VARIANT_MAP.default;
	const shadowClass = getShadowClass(shadowStyle);
	const targetContainer = container ?? (typeof document !== "undefined" ? document.body : null);

	if (!targetContainer) return null;

	const isVisible = open || ink > 0.01;
	if (!isVisible) return null;

	return createPortal(
		<div
			ref={(node) => {
				contentRef.current = node;
				if (node && !coords) {
					updatePosition();
				}
			}}
			id={popoverId}
			role="dialog"
			aria-modal="false"
			aria-hidden={!open}
			inert={!open}
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
					opacity: ink,
					borderColor: "transparent",
					pointerEvents: open ? "auto" : "none",
					...meta.style,
					...style,
				} as CSSProperties
			}
			className={cn(
				"relative z-50 w-72 rounded-2xl border-2 p-4 text-sm outline-none select-none",
				meta.className,
				shadowClass,
				className,
			)}
			{...props}
		>
			{coords && (
				<BubbleOutline
					width={coords.width}
					height={coords.height}
					side={coords.actualSide}
					arrowOffset={coords.arrowOffset}
					showArrow={showArrow && bubbleStyle !== "sticker"}
					progress={ink}
				/>
			)}
			{/* 卡通气泡顶部微光条 */}
			{showShine && (
				<span
					aria-hidden="true"
					className="pointer-events-none absolute top-2.5 left-4.5 h-1 w-6 rounded-full bg-white/50 dark:bg-white/15"
				/>
			)}

			{/* 右上角关闭按钮 */}
			{showClose && <CartoonPopoverClose className="absolute top-3.5 right-3.5" />}

			{/* 可选快捷头部 */}
			{title && (
				<CartoonPopoverHeader divided={divided}>
					{typeof title === "string" ? (
						<CartoonPopoverTitle>{title}</CartoonPopoverTitle>
					) : (
						title
					)}
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
		</div>,
		targetContainer,
	);
}

/**
 * CartoonPopoverHeader 头部容器（带卡通虚线底边分隔）。
 */
export function CartoonPopoverHeader({
	className,
	divided = false,
	children,
	...props
}: CartoonPopoverHeaderProps) {
	return (
		<div
			className={cn(
				"mb-2 flex items-center justify-between gap-3",
				divided && "border-b-2 border-dashed border-current/15 pb-2",
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
				"inline-flex size-6 shrink-0 items-center justify-center rounded-full text-current/50 transition-all hover:bg-current/10 hover:text-current active:scale-90",
				className,
			)}
			{...props}
		>
			<X className="size-3.5 stroke-[2.2]" />
		</button>
	);
}
