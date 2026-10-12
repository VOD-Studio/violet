"use client";

import { cn } from "cn";
import { Slot } from "radix-ui";
import {
	composeEventHandlers,
	Popper,
	useComposedRefs,
	useControllableState,
} from "radix-ui/internal";
import type * as React from "react";
import {
	createContext,
	type RefObject,
	use,
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { isKeyboardFocus, useDropdownHighlight } from "./use-dropdown-highlight";
import { prefersReducedMotion, useDropdownMotion } from "./use-dropdown-motion";

interface GroupState {
	skipDelay: number;
	/** 组内当前展开的菜单；新菜单展开时由它立即收起上一个。 */
	active: { id: string; close: () => void } | null;
	lastClosedAt: number;
	/** 组内最近挂载的面板（展开中或正在退场），供下一块面板接力变形。 */
	surface: { id: string; element: HTMLElement; release: () => void } | null;
}

interface DropdownSurfaceSnapshot {
	rect: DOMRect;
	side: string | undefined;
	release: () => void;
}

const GroupContext = createContext<RefObject<GroupState> | null>(null);

function insideRect(rect: DOMRect | undefined, x: number, y: number) {
	return (
		rect !== undefined &&
		rect.width > 0 &&
		rect.height > 0 &&
		x >= rect.left &&
		x <= rect.right &&
		y >= rect.top &&
		y <= rect.bottom
	);
}

/** 触发器、面板与上下间隙共同组成闭合安全区。 */
function insideSafeArea(x: number, y: number, t: DOMRect | undefined, c: DOMRect | undefined) {
	if (insideRect(t, x, y) || insideRect(c, x, y)) return true;
	if (!t || !c || !t.width || !t.height || !c.width || !c.height) return false;
	const below = c.top >= t.bottom;
	const above = c.bottom <= t.top;
	if (!below && !above) return false;
	return (
		y >= (below ? t.bottom : c.bottom) &&
		y <= (below ? c.top : t.top) &&
		x >= Math.min(t.left, c.left) &&
		x <= Math.max(t.right, c.right)
	);
}

interface PointerPoint {
	x: number;
	y: number;
}

interface DropdownContextValue {
	id: string;
	open: boolean;
	contentId: string;
	handoff: boolean;
	setHandoff: (handoff: boolean) => void;
	triggerRef: RefObject<HTMLElement | null>;
	contentRef: RefObject<HTMLElement | null>;
	pointerEnter: () => void;
	pointerLeave: (point: PointerPoint) => void;
	focusIn: () => void;
	focusOut: (next: EventTarget | null) => void;
}

const DropdownContext = createContext<DropdownContextValue | null>(null);

function useDropdown(part: string): DropdownContextValue {
	const context = use(DropdownContext);
	if (!context) throw new Error(`${part} must be used within <Dropdown>.`);
	return context;
}

export interface DropdownGroupProps {
	/** 组内菜单收起后，仍视为「已预热」而免去展开延迟的毫秒数。 */
	skipDelay?: number;
	children: React.ReactNode;
}

/**
 * 一组并列的悬停菜单：同一时刻只展开一个，指针在它们之间移动时后一个立即展开。
 */
export function DropdownGroup({ skipDelay = 400, children }: DropdownGroupProps) {
	const state = useRef<GroupState>({
		skipDelay,
		active: null,
		lastClosedAt: -Infinity,
		surface: null,
	});
	state.current.skipDelay = skipDelay;
	return <GroupContext value={state}>{children}</GroupContext>;
}

export interface DropdownProps {
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
	/** 指针进入触发器后展开前的等待毫秒数。 */
	openDelay?: number;
	/** 指针离开触发器与内容后收起前的宽限毫秒数，足够指针穿过两者之间的间隙。 */
	closeDelay?: number;
	children: React.ReactNode;
}

/**
 * 悬停（或键盘聚焦）展开的下拉面板。点击不参与开合：展开只由指针停留、键盘焦点决定，
 * Escape 收起。触屏没有悬停，触屏上不会展开。
 */
export function Dropdown({
	open: openProp,
	defaultOpen = false,
	onOpenChange,
	openDelay = 80,
	closeDelay = 140,
	children,
}: DropdownProps) {
	const id = useId();
	const group = use(GroupContext);
	const [open = false, setOpen] = useControllableState({
		prop: openProp,
		defaultProp: defaultOpen,
		onChange: onOpenChange,
	});
	const timer = useRef(0);
	const timerTarget = useRef<boolean | null>(null);
	const hovering = useRef(false);
	/** Escape 收起后，指针需先离开再进入才会重新展开。 */
	const dismissed = useRef(false);
	const triggerRef = useRef<HTMLElement>(null);
	const contentRef = useRef<HTMLElement>(null);
	const geometryRef = useRef<{
		trigger: DOMRect | undefined;
		content: DOMRect | undefined;
	} | null>(null);
	const geometryFrame = useRef(0);
	const isInside = useCallback((x: number, y: number) => {
		let geometry = geometryRef.current;
		if (!geometry) {
			geometry = {
				trigger: triggerRef.current?.getBoundingClientRect(),
				content: contentRef.current?.getBoundingClientRect(),
			};
			geometryRef.current = geometry;
			if (!geometryFrame.current) {
				geometryFrame.current = requestAnimationFrame(() => {
					geometryRef.current = null;
					geometryFrame.current = 0;
				});
			}
		}
		return insideSafeArea(x, y, geometry.trigger, geometry.content);
	}, []);
	/** 同方向接力确认后，旧面板外壳立即让位。 */
	const [handoff, setHandoff] = useState(false);

	useLayoutEffect(() => {
		if (open) setHandoff(false);
	}, [open]);

	const schedule = useCallback(
		(next: boolean, delay: number) => {
			window.clearTimeout(timer.current);
			timerTarget.current = null;
			if (delay <= 0) setOpen(next);
			else {
				timerTarget.current = next;
				timer.current = window.setTimeout(() => {
					timer.current = 0;
					timerTarget.current = null;
					setOpen(next);
				}, delay);
			}
		},
		[setOpen],
	);
	const cancelClose = useCallback(() => {
		if (timerTarget.current !== false) return;
		window.clearTimeout(timer.current);
		timer.current = 0;
		timerTarget.current = null;
	}, []);

	useEffect(
		() => () => {
			window.clearTimeout(timer.current);
			cancelAnimationFrame(geometryFrame.current);
		},
		[],
	);

	useEffect(() => {
		if (!open || !group) return;
		const state = group.current;
		if (state.active && state.active.id !== id) state.active.close();
		state.active = {
			id,
			close: () => setOpen(false),
		};
		return () => {
			if (state.active?.id !== id) return;
			state.active = null;
			state.lastClosedAt = performance.now();
		};
	}, [open, group, id, setOpen]);

	useEffect(() => {
		if (!open) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			dismissed.current = true;
			schedule(false, 0);
			if (contentRef.current?.contains(document.activeElement)) triggerRef.current?.focus();
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [open, schedule]);

	const pointerEnter = useCallback(() => {
		hovering.current = true;
		if (dismissed.current) return;
		const state = group?.current;
		const warm =
			state !== undefined &&
			(state.active !== null || performance.now() - state.lastClosedAt < state.skipDelay);
		schedule(true, contentRef.current || warm ? 0 : openDelay);
	}, [group, openDelay, schedule]);

	const pointerLeave = useCallback(
		(point: PointerPoint) => {
			// 转场快照或裁剪动画可能派发 leave，但坐标仍在面板与间隙内。
			geometryRef.current = null;
			if (isInside(point.x, point.y)) {
				hovering.current = true;
				cancelClose();
				return;
			}
			hovering.current = false;
			dismissed.current = false;
			schedule(false, closeDelay);
		},
		[cancelClose, closeDelay, isInside, schedule],
	);

	// 转场快照可能吞掉 leave；Escape 后也须确认指针真正移出安全区。
	useEffect(() => {
		if (!open && !dismissed.current) return;
		const onPointerMove = (event: PointerEvent) => {
			if (!open && !dismissed.current) {
				document.removeEventListener("pointermove", onPointerMove);
				return;
			}
			if (event.pointerType === "touch") return;
			if (isInside(event.clientX, event.clientY)) {
				hovering.current = true;
				cancelClose();
				return;
			}
			if (!hovering.current && !dismissed.current) return;
			hovering.current = false;
			dismissed.current = false;
			if (open) schedule(false, closeDelay);
			else {
				cancelClose();
				document.removeEventListener("pointermove", onPointerMove);
			}
		};
		document.addEventListener("pointermove", onPointerMove);
		return () => document.removeEventListener("pointermove", onPointerMove);
	}, [open, cancelClose, closeDelay, isInside, schedule]);

	const focusIn = useCallback(() => {
		if (!dismissed.current) schedule(true, 0);
	}, [schedule]);

	const focusOut = useCallback(
		(next: EventTarget | null) => {
			const inside =
				next instanceof Node &&
				(triggerRef.current?.contains(next) || contentRef.current?.contains(next));
			if (inside) return;
			dismissed.current = false;
			if (!hovering.current) schedule(false, 0);
		},
		[schedule],
	);

	return (
		<Popper.Root>
			<DropdownContext
				value={{
					id,
					open,
					contentId: `${id}-content`,
					handoff,
					setHandoff,
					triggerRef,
					contentRef,
					pointerEnter,
					pointerLeave,
					focusIn,
					focusOut,
				}}
			>
				{children}
			</DropdownContext>
		</Popper.Root>
	);
}

interface NativeTriggerProps extends React.ComponentProps<"button"> {
	asChild?: false;
}

interface AsChildTriggerProps extends React.HTMLAttributes<HTMLElement> {
	/** 将属性与 ref 合并到唯一子元素，常用于链接；自定义组件必须透传属性与 ref。 */
	asChild: true;
	ref?: React.Ref<HTMLElement>;
}

/** 原生模式的 ref 与事件指向 button；asChild 模式指向子元素。 */
export type DropdownTriggerProps = NativeTriggerProps | AsChildTriggerProps;

/** 触摸不产生悬停，只响应鼠标与笔；把事件坐标交给处理函数。 */
const hoverOnly = (handler: (point: PointerPoint) => void) => (event: React.PointerEvent) => {
	if (event.pointerType !== "touch") handler({ x: event.clientX, y: event.clientY });
};

/**
 * 面板的锚点与悬停热区。点击不改变展开状态，激活行为（如链接跳转）完全留给触发元素自身。
 */
export function DropdownTrigger({ asChild, ref, ...props }: DropdownTriggerProps) {
	const context = useDropdown("DropdownTrigger");
	const composedRef = useComposedRefs<HTMLElement>(
		ref as React.Ref<HTMLElement>,
		context.triggerRef,
	);
	const Component = asChild ? Slot.Root : "button";

	return (
		<Popper.Anchor asChild>
			<Component
				data-slot="dropdown-trigger"
				data-state={context.open ? "open" : "closed"}
				aria-expanded={context.open}
				aria-controls={context.open ? context.contentId : undefined}
				type={asChild ? undefined : "button"}
				{...(props as React.HTMLAttributes<HTMLElement>)}
				ref={composedRef as React.Ref<HTMLButtonElement>}
				onPointerEnter={composeEventHandlers(
					props.onPointerEnter,
					hoverOnly(context.pointerEnter),
				)}
				onPointerLeave={composeEventHandlers(
					props.onPointerLeave,
					hoverOnly(context.pointerLeave),
				)}
				onFocus={composeEventHandlers(
					props.onFocus,
					(event: React.FocusEvent<HTMLElement>) => {
						if (isKeyboardFocus(event.currentTarget)) context.focusIn();
					},
				)}
				onBlur={composeEventHandlers(props.onBlur, (event: React.FocusEvent<HTMLElement>) =>
					context.focusOut(event.relatedTarget),
				)}
			/>
		</Popper.Anchor>
	);
}

/** 原生模式保留 button 表单属性；asChild 的 ref 与事件指向子元素。 */
export type DropdownItemProps = NativeTriggerProps | AsChildTriggerProps;

/** 声明参与共享高亮的交互行，不改变点击与 Tab 语义。 */
export function DropdownItem({ asChild, ref, className, ...props }: DropdownItemProps) {
	const Component = asChild ? Slot.Root : "button";
	return (
		<Component
			type={asChild ? undefined : "button"}
			{...(props as React.HTMLAttributes<HTMLElement>)}
			data-slot="dropdown-item"
			ref={ref as React.Ref<HTMLButtonElement>}
			className={cn("v-dropdown__item", className)}
		/>
	);
}

export interface DropdownContentProps extends React.ComponentProps<"div"> {
	/** 首选方位；空间不足时自动翻到对侧。 */
	side?: "bottom" | "top";
	align?: "start" | "center" | "end";
	/** 面板与触发器的间距，指针经过这段间隙时面板不会收起。 */
	sideOffset?: number;
	collisionPadding?: number;
}

/**
 * 悬停面板。内容紧随触发器渲染（不入 Portal），Tab 顺序从触发器自然进入面板。
 *
 * 单个面板按实际上下方位裁剪展开与收拢，不改变透明度。
 * 同组仅在相同方位间接力；内部内容不做独立动画。
 * 动画不缩放，减弱动态时直接显示。
 */
export function DropdownContent({ ref, ...props }: DropdownContentProps) {
	const context = useDropdown("DropdownContent");
	const [present, setPresent] = useState(context.open);
	const onExitComplete = useCallback(() => setPresent(false), []);
	useLayoutEffect(() => {
		if (context.open) setPresent(true);
	}, [context.open]);
	return context.open || present ? (
		<DropdownContentImpl {...props} contentRef={ref} onExitComplete={onExitComplete} />
	) : null;
}

interface DropdownContentImplProps extends DropdownContentProps {
	contentRef?: React.Ref<HTMLDivElement>;
	onExitComplete: () => void;
}

function DropdownContentImpl({
	className,
	side = "bottom",
	align = "center",
	sideOffset = 8,
	collisionPadding = 8,
	style,
	children,
	ref,
	contentRef,
	onExitComplete,
	...props
}: DropdownContentImplProps) {
	const context = useDropdown("DropdownContent");
	const group = use(GroupContext);
	const elementRef = useRef<HTMLDivElement>(null);
	const innerRef = useRef<HTMLDivElement>(null);
	const morphAnimationRef = useRef<Animation | null>(null);
	const highlight = useDropdownHighlight(innerRef);
	const composedRef = useComposedRefs<HTMLDivElement>(
		ref,
		contentRef,
		context.contentRef as RefObject<HTMLDivElement | null>,
		elementRef,
	);
	const { id, setHandoff } = context;
	const cancelMorph = useCallback(() => {
		const animation = morphAnimationRef.current;
		morphAnimationRef.current = null;
		animation?.cancel();
		innerRef.current?.style.removeProperty("width");
	}, []);
	const { reveal, fade, cancel } = useDropdownMotion({
		elementRef,
		open: context.open,
		onExitComplete,
		onReducedMotion: cancelMorph,
	});
	// 接力：组内上一块面板仍留在 DOM 里（展开中或正在退场）时，从它的位置与尺寸变形而来
	const takeover = (): DropdownSurfaceSnapshot | null => {
		const previous = group?.current.surface;
		if (!previous || previous.id === id || !previous.element.isConnected) return null;
		return {
			rect: previous.element.getBoundingClientRect(),
			side: previous.element.dataset.side,
			release: previous.release,
		};
	};
	const [from, setFrom] = useState(takeover);
	const placed = useRef(false);

	const play = (source: DropdownSurfaceSnapshot | null) => {
		const element = elementRef.current;
		if (!element) return false;
		cancelMorph();
		if (!source) return false;
		if (source.side !== element.dataset.side) {
			setFrom(null);
			return false;
		}
		source.release();
		cancel();
		if (typeof element.animate !== "function" || prefersReducedMotion()) return true;
		const to = element.getBoundingClientRect();
		const start = source.rect;
		const inner = innerRef.current;
		const innerWidth = inner?.getBoundingClientRect().width;
		// 内容按最终宽度排版，面板变形期间文字不重排。
		if (inner && innerWidth) inner.style.width = `${innerWidth}px`;
		const animation = element.animate(
			[
				{
					transform: `translate(${start.left - to.left}px, ${start.top - to.top}px)`,
					width: `${start.width}px`,
					height: `${start.height}px`,
					overflow: "hidden",
				},
				{
					transform: "translate(0px, 0px)",
					width: `${to.width}px`,
					height: `${to.height}px`,
					overflow: "hidden",
				},
			],
			{ duration: 380, easing: "cubic-bezier(0.45, 0, 0.2, 1)", fill: "both" },
		);
		morphAnimationRef.current = animation;
		const restoreWidth = () => {
			if (morphAnimationRef.current !== animation) return;
			morphAnimationRef.current = null;
			inner?.style.removeProperty("width");
			animation.cancel();
		};
		animation.addEventListener("finish", restoreWidth, { once: true });
		animation.addEventListener("cancel", restoreWidth, { once: true });
		return true;
	};

	const handlePlaced = () => {
		if (placed.current) return;
		placed.current = true;
		if (!context.open || !play(from)) reveal(context.open);
	};

	const wasOpen = useRef(context.open);
	// biome-ignore lint/correctness/useExhaustiveDependencies: 定位更新不重启动画，仅在开合或接力状态改变时调度。
	useLayoutEffect(() => {
		if (!context.open) {
			if (context.handoff) fade();
			else reveal(false);
		} else if (!wasOpen.current && placed.current) {
			const next = takeover();
			setFrom(next);
			if (!play(next)) reveal(true);
		}
		wasOpen.current = context.open;
	}, [context.open, context.handoff, fade, reveal]);

	// 展开时登记为组内最新的面板；必须排在接力取值之后。退场中的面板仍保持登记，供下一块接力
	useEffect(() => {
		const state = group?.current;
		const element = elementRef.current;
		if (!state || !element || !context.open) return;
		state.surface = {
			id,
			element,
			release: () => {
				morphAnimationRef.current?.pause();
				setHandoff(true);
			},
		};
	}, [group, id, setHandoff, context.open]);

	useLayoutEffect(() => cancelMorph, [cancelMorph]);
	useEffect(() => {
		const state = group?.current;
		const element = elementRef.current;
		return () => {
			if (state && state.surface?.element === element) state.surface = null;
		};
	}, [group]);

	return (
		<Popper.Content
			data-slot="dropdown-content"
			data-state={context.open ? "open" : "closed"}
			data-motion={from ? "morph" : "reveal"}
			data-handoff={context.handoff || undefined}
			id={context.contentId}
			side={side}
			align={align}
			sideOffset={sideOffset}
			collisionPadding={collisionPadding}
			onPlaced={handlePlaced}
			className={cn("v-dropdown__content", className)}
			style={{ "--v-dropdown-bridge": `${sideOffset}px`, ...style } as React.CSSProperties}
			{...props}
			ref={composedRef}
			onPointerEnter={composeEventHandlers(
				props.onPointerEnter,
				hoverOnly(context.pointerEnter),
			)}
			onPointerOver={composeEventHandlers(props.onPointerOver, highlight.pointer)}
			onPointerMove={composeEventHandlers(props.onPointerMove, highlight.pointer)}
			onPointerLeave={composeEventHandlers(
				props.onPointerLeave,
				(event: React.PointerEvent<HTMLDivElement>) => {
					hoverOnly(context.pointerLeave)(event);
					highlight.leave(event);
				},
			)}
			onFocus={composeEventHandlers(
				props.onFocus,
				(event: React.FocusEvent<HTMLDivElement>) => {
					context.focusIn();
					highlight.focus(event);
				},
			)}
			onBlur={composeEventHandlers(
				props.onBlur,
				(event: React.FocusEvent<HTMLDivElement>) => {
					context.focusOut(event.relatedTarget);
					highlight.blur(event);
				},
			)}
		>
			<div ref={innerRef} className="v-dropdown__inner">
				<span
					aria-hidden="true"
					data-slot="dropdown-highlight"
					data-visible={highlight.geometry?.visible || undefined}
					data-animated={highlight.animated || undefined}
					className="v-dropdown__highlight"
					style={
						highlight.geometry
							? {
									transform: `translate3d(${highlight.geometry.x}px, ${highlight.geometry.y}px, 0)`,
									width: highlight.geometry.width,
									height: highlight.geometry.height,
									borderRadius: highlight.geometry.radius,
								}
							: undefined
					}
				/>
				{children}
			</div>
		</Popper.Content>
	);
}
