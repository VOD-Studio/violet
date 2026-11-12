import { cn } from "cn";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import {
	type ComponentProps,
	createContext,
	type MutableRefObject,
	type Ref,
	type RefCallback,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { Kbd, type KbdKey } from "../kbd";

/** 指针离开触发器后到开始退回的等待；留给「移到相邻按钮」。 */
const LEAVE_DELAY = 60;
/** 相邻切换时同一个气泡滑到新位置的时长，曲线与浮出一致。 */
const SLIDE_DURATION = 180;
const SLIDE_EASING = "cubic-bezier(0.32, 0.72, 0, 1)";
/** 等待 60ms 加退回 120ms：提示在这段时间内仍看得见，之后才算「没有提示」。 */
const SKIP_DELAY_DURATION = 180;

/** 提示的气泡：新气泡接手它的位置并让它立刻消失。 */
interface Bubble {
	wrapper: HTMLElement;
	content: HTMLElement;
	superseded: boolean;
}

interface BubbleRegistry {
	current: Bubble | null;
}

const BubbleRegistryContext = createContext<BubbleRegistry | null>(null);

interface TooltipControls {
	triggerRef: MutableRefObject<HTMLElement | null>;
	/** 指针离开触发器：接下来的收起要先等 LEAVE_DELAY。 */
	markPointerLeave: () => void;
	/** 指针回到触发器、聚焦或按下：取消等待中的收起。 */
	cancelPendingClose: () => void;
}

const TooltipControlsContext = createContext<TooltipControls | null>(null);

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
	if (typeof ref === "function") ref(value);
	else if (ref) (ref as MutableRefObject<T | null>).current = value;
}

function isTruncated(element: HTMLElement | null) {
	if (!element) return false;
	return element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight;
}

/**
 * 提示的作用域，一般放在应用根部，整页同时只显示一个提示。
 *
 * @remarks 默认 `delayDuration=0`、`skipDelayDuration=180`（等待加退回，提示还在的时间）、
 * `disableHoverableContent`（提示不接收指针）；三者都可由属性覆盖。
 * 相邻切换时的位置交接记录在这里，所以相邻触发器必须在同一个 Provider 下。
 */
function TooltipProvider({
	delayDuration = 0,
	skipDelayDuration = SKIP_DELAY_DURATION,
	disableHoverableContent = true,
	...props
}: ComponentProps<typeof TooltipPrimitive.Provider>) {
	const registry = useRef<BubbleRegistry>({ current: null });
	return (
		<BubbleRegistryContext value={registry.current}>
			<TooltipPrimitive.Provider
				data-slot="tooltip-provider"
				delayDuration={delayDuration}
				skipDelayDuration={skipDelayDuration}
				disableHoverableContent={disableHoverableContent}
				{...props}
			/>
		</BubbleRegistryContext>
	);
}

/** {@link Tooltip} 的属性：Radix Tooltip 根的属性，加 `truncatedOnly`。 */
export interface TooltipProps extends ComponentProps<typeof TooltipPrimitive.Root> {
	/**
	 * 只有触发器里的文字确实被截断（`scrollWidth > clientWidth`，或多行截断的
	 * `scrollHeight > clientHeight`）时才出现；触发器本身须是承担截断的那个元素。
	 */
	truncatedOnly?: boolean;
}

/**
 * 一个提示。受控与非受控都支持；`onOpenChange(false)` 在指针离开后晚 60ms 触发，
 * 按下触发器、Esc、失焦与被另一个提示顶替则立即触发。
 */
function Tooltip({
	open: openProp,
	defaultOpen = false,
	onOpenChange,
	truncatedOnly = false,
	...props
}: TooltipProps) {
	const [innerOpen, setInnerOpen] = useState(defaultOpen);
	const controlled = openProp !== undefined;
	const open = controlled ? openProp : innerOpen;

	const triggerRef = useRef<HTMLElement | null>(null);
	const closeTimer = useRef<number | undefined>(undefined);
	const pointerLeft = useRef(false);
	const latest = useRef({ controlled, onOpenChange, truncatedOnly });
	latest.current = { controlled, onOpenChange, truncatedOnly };

	const clearTimer = useCallback(() => {
		window.clearTimeout(closeTimer.current);
		closeTimer.current = undefined;
	}, []);
	useEffect(() => clearTimer, [clearTimer]);

	const commit = useCallback((next: boolean) => {
		if (!latest.current.controlled) setInnerOpen(next);
		latest.current.onOpenChange?.(next);
	}, []);

	const handleOpenChange = useCallback(
		(next: boolean) => {
			clearTimer();
			if (next) {
				pointerLeft.current = false;
				if (latest.current.truncatedOnly && !isTruncated(triggerRef.current)) return;
				commit(true);
				return;
			}
			if (pointerLeft.current) {
				pointerLeft.current = false;
				closeTimer.current = window.setTimeout(() => commit(false), LEAVE_DELAY);
				return;
			}
			commit(false);
		},
		[clearTimer, commit],
	);

	const controls = useMemo<TooltipControls>(
		() => ({
			triggerRef,
			markPointerLeave: () => {
				pointerLeft.current = true;
			},
			cancelPendingClose: () => {
				pointerLeft.current = false;
				clearTimer();
			},
		}),
		[clearTimer],
	);

	return (
		<TooltipControlsContext value={controls}>
			<TooltipPrimitive.Root open={open} onOpenChange={handleOpenChange} {...props} />
		</TooltipControlsContext>
	);
}

/** 触发器：Radix Tooltip 触发器，可 `asChild`。 */
function TooltipTrigger({
	ref,
	onPointerLeave,
	onPointerMove,
	onPointerDown,
	onFocus,
	...props
}: ComponentProps<typeof TooltipPrimitive.Trigger>) {
	const controls = useContext(TooltipControlsContext);
	const setRef = useCallback<RefCallback<HTMLButtonElement>>(
		(node) => {
			if (controls) controls.triggerRef.current = node;
			assignRef(ref, node);
		},
		[controls, ref],
	);
	return (
		<TooltipPrimitive.Trigger
			data-slot="tooltip-trigger"
			ref={setRef}
			onPointerLeave={(event) => {
				onPointerLeave?.(event);
				controls?.markPointerLeave();
			}}
			onPointerMove={(event) => {
				onPointerMove?.(event);
				if (event.pointerType !== "touch") controls?.cancelPendingClose();
			}}
			onPointerDown={(event) => {
				onPointerDown?.(event);
				controls?.cancelPendingClose();
			}}
			onFocus={(event) => {
				onFocus?.(event);
				controls?.cancelPendingClose();
			}}
			{...props}
		/>
	);
}

/** 气泡属性：箭头、快捷键与 Portal 容器之外均为 Radix Tooltip.Content 的属性。 */
export interface TooltipContentProps extends ComponentProps<typeof TooltipPrimitive.Content> {
	/** 带箭头，默认 true；气泡离触发器 9px，不带箭头 6px。 */
	arrow?: boolean;
	/** 快捷键组合，一个组合一个键帽，写在名称之后。 */
	shortcut?: readonly KbdKey[];
	/** Portal 的挂载容器，默认挂到 body。 */
	container?: ComponentProps<typeof TooltipPrimitive.Portal>["container"];
}

/**
 * 提示的气泡。只放文字与快捷键，气泡本身不接收指针，不要放链接和按钮。
 *
 * @remarks 提示还在时移到另一个触发器：新气泡不再走出现动画，
 * 从上一个气泡的位置滑到新位置（180ms），上一个立刻消失；减弱动态下不滑动，只淡入。
 */
function TooltipContent({
	className,
	arrow = true,
	shortcut,
	container,
	sideOffset,
	collisionPadding = 8,
	children,
	ref,
	...props
}: TooltipContentProps) {
	const registry = useContext(BubbleRegistryContext);
	const contentRef = useRef<HTMLDivElement | null>(null);
	const userRef = useRef(ref);
	userRef.current = ref;
	const predecessor = useRef<{ bubble: Bubble; animated: boolean } | null>(null);
	const [sliding, setSliding] = useState(false);

	// 内容经 Portal 与 Presence 晚一拍才挂上，登记只能放在 ref 回调里；回调必须稳定，否则每次渲染都重新登记。
	const attach = useCallback(
		(node: HTMLDivElement | null) => {
			contentRef.current = node;
			assignRef(userRef.current, node);
			if (!node || !registry) return;
			const wrapper = node.parentElement;
			if (!wrapper) return;
			const self: Bubble = { wrapper, content: node, superseded: false };
			const previous = registry.current;
			registry.current = self;
			if (previous?.wrapper.isConnected && !previous.superseded) {
				const animated =
					!node.closest('[data-motion="reduce"]') &&
					!window.matchMedia("(prefers-reduced-motion: reduce)").matches;
				predecessor.current = { bubble: previous, animated };
				if (animated) {
					setSliding(true);
				}
			}
			return () => {
				if (registry.current === self) registry.current = null;
				contentRef.current = null;
				assignRef(userRef.current, null);
			};
		},
		[registry],
	);

	// Radix 的类型里没有 onPlaced，但内容属性会原样传到 Popper；位置算好的那一刻才能量到终点。
	const placed = {
		onPlaced: () => {
			const next = contentRef.current?.parentElement;
			const previous = predecessor.current;
			predecessor.current = null;
			if (!next || !previous) return;
			const from = previous.bubble.wrapper.getBoundingClientRect();
			previous.bubble.superseded = true;
			// 不能直接 display:none：Radix 等不到退回动画的结束就不卸载；缩成 1ms 让它自己走完
			previous.bubble.wrapper.style.visibility = "hidden";
			previous.bubble.content.style.animationDuration = "1ms";
			previous.bubble.content.style.animationDelay = "0s";
			if (!previous.animated || typeof next.animate !== "function") return;
			const to = next.getBoundingClientRect();
			next.animate(
				[
					{ translate: `${from.left - to.left}px ${from.top - to.top}px` },
					{ translate: "0 0" },
				],
				{ duration: SLIDE_DURATION, easing: SLIDE_EASING },
			);
		},
	};

	return (
		<TooltipPrimitive.Portal container={container}>
			<TooltipPrimitive.Content
				data-slot="tooltip-content"
				data-sliding={sliding ? "" : undefined}
				sideOffset={sideOffset ?? (arrow ? 0 : 6)}
				collisionPadding={collisionPadding}
				className={cn("v-tooltip v-float", className)}
				ref={attach}
				{...placed}
				{...props}
			>
				<span className="v-tooltip__text">{children}</span>
				{shortcut && shortcut.length > 0 ? (
					<Kbd size="sm" keys={shortcut} className="v-tooltip__keys" />
				) : null}
				{arrow ? (
					<TooltipPrimitive.Arrow asChild width={9} height={9}>
						<span className="v-tooltip__arrow" />
					</TooltipPrimitive.Arrow>
				) : null}
			</TooltipPrimitive.Content>
		</TooltipPrimitive.Portal>
	);
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
