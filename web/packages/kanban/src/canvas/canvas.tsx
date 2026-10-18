import {
	type HTMLAttributes,
	type KeyboardEvent,
	type ReactNode,
	type Ref,
	useCallback,
	useEffect,
	useId,
	useImperativeHandle,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	DEFAULT_FIT_PADDING,
	DEFAULT_SCALE_LIMITS,
	type FitOptions,
	fitViewport,
	IDENTITY_VIEWPORT,
	normalizeViewport,
	panBy,
	panWithin,
	revealRect,
	type ScaleLimits,
	stepScale,
	type Viewport,
	zoomAt,
} from "../core/index.ts";
import type { Locale } from "../locale.ts";
import { EDITING_EVENT, PAN_EVENT, type PanRequest } from "../pan-region.ts";
import { type CanvasMessages, resolveCanvasMessages, zoomStatusText } from "./messages.ts";
import { useCanvasGestures } from "./use-canvas-gestures.ts";
import { useInertOutside } from "./use-inert-outside.ts";

/** 方向键每次平移的距离（px），按住 Shift 为 4 倍。 */
const KEY_PAN = 48;
/** 聚焦的元素离视口边缘至少留出多少 px，容得下聚焦环。 */
const REVEAL_MARGIN = 8;

/** `Canvas` 的命令式句柄。 */
export interface CanvasHandle {
	/** 适应窗口，并恢复随窗口尺寸变化自动适应。 */
	fit(): void;
	zoomIn(): void;
	zoomOut(): void;
	setViewport(viewport: Viewport): void;
	getViewport(): Viewport;
}

/** `Canvas` 的属性；其余 `div` 属性落在根节点。 */
export interface CanvasProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
	children: ReactNode;
	ref?: Ref<CanvasHandle>;
	/** 初始视口；不给时挂载后适应窗口，并在窗口尺寸变化时重新适应，直到用户平移或缩放。 */
	defaultViewport?: Viewport;
	/** 视口变化时调用，包括手势、按钮与键盘引起的变化。 */
	onViewportChange?: (viewport: Viewport) => void;
	/**
	 * 缩放范围。
	 * @default { min: 0.3, max: 2 }
	 */
	scaleLimits?: ScaleLimits;
	/** 适应窗口的选项：内边距、最小与最大缩放。 */
	fit?: FitOptions;
	/**
	 * 是否显示控件条（缩放、适应窗口、全屏）。
	 * @default true
	 */
	controls?: boolean;
	/** 进入或退出全屏时调用。 */
	onFullscreenChange?: (fullscreen: boolean) => void;
	/** 内置文案的语言。 */
	locale?: Locale;
	/** 覆盖内置文案，只需给出要改的键。 */
	messages?: Partial<CanvasMessages>;
}

const sameViewport = (a: Viewport, b: Viewport) =>
	a.scale === b.scale && a.x === b.x && a.y === b.y;

const transformOf = (viewport: Viewport) =>
	`translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`;

function Icon({ children }: { children: ReactNode }) {
	return (
		<svg
			viewBox="0 0 16 16"
			width="16"
			height="16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			{children}
		</svg>
	);
}

/**
 * 可平移缩放的画布视口，承载整块看板或其他内容。
 *
 * 拖动背景平移；Ctrl/⌘ 加滚轮、按钮、键盘与触屏双指缩放；普通滚轮仍然滚动页面。可全屏，Esc 退出。
 * 视口聚焦时方向键平移、`+` `-` 缩放、`0` 适应窗口。
 */
export function Canvas({
	children,
	ref,
	defaultViewport,
	onViewportChange,
	scaleLimits = DEFAULT_SCALE_LIMITS,
	fit: fitOptions,
	controls = true,
	onFullscreenChange,
	locale,
	messages: overrides,
	className,
	...rest
}: CanvasProps) {
	const messages = resolveCanvasMessages(locale, overrides);
	const limits = useMemo(
		() => ({ min: scaleLimits.min, max: scaleLimits.max }),
		[scaleLimits.min, scaleLimits.max],
	);
	const hintId = useId();
	const rootRef = useRef<HTMLDivElement>(null);
	const viewportRef = useRef<HTMLDivElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	const [view, setView] = useState<{ viewport: Viewport; animate: boolean }>({
		viewport: normalizeViewport(defaultViewport ?? IDENTITY_VIEWPORT, limits),
		animate: false,
	});
	const [fullscreen, setFullscreen] = useState(false);
	const [status, setStatus] = useState("");

	const latest = useRef({
		viewport: view.viewport,
		onViewportChange,
		fitOptions,
		messages,
		onFullscreenChange,
	});
	latest.current = {
		...latest.current,
		onViewportChange,
		fitOptions,
		messages,
		onFullscreenChange,
	};
	/** 为 false 时窗口尺寸变化会重新适应；用户平移或缩放之后为 true。 */
	const adjusted = useRef(defaultViewport !== undefined);

	const apply = useCallback(
		(requested: Viewport, options: { animate?: boolean; user?: boolean } = {}) => {
			const next = normalizeViewport(requested, limits);
			if (sameViewport(latest.current.viewport, next)) return;
			latest.current.viewport = next;
			if (options.user) adjusted.current = true;
			setView({ viewport: next, animate: Boolean(options.animate) });
			latest.current.onViewportChange?.(next);
		},
		[limits],
	);

	const measure = useCallback(() => {
		const viewportElement = viewportRef.current;
		const contentElement = contentRef.current;
		if (!viewportElement || !contentElement) return null;
		return {
			container: { width: viewportElement.clientWidth, height: viewportElement.clientHeight },
			content: { width: contentElement.scrollWidth, height: contentElement.scrollHeight },
			// 布局尺寸，不含溢出：拖拽中的浮起卡片是溢出的，不能撑大平移范围
			bounds: { width: contentElement.offsetWidth, height: contentElement.offsetHeight },
		};
	}, []);

	const refit = useCallback(
		(options: { animate?: boolean } = {}) => {
			const sizes = measure();
			if (!sizes || sizes.container.width === 0 || sizes.container.height === 0) return;
			adjusted.current = false;
			apply(
				fitViewport(sizes.container, sizes.content, {
					limits,
					...latest.current.fitOptions,
				}),
				options,
			);
		},
		[apply, limits, measure],
	);

	const announceZoom = useCallback(
		(scale: number) => setStatus(zoomStatusText(latest.current.messages, scale)),
		[],
	);

	const zoomBy = useCallback(
		(direction: 1 | -1) => {
			const sizes = measure();
			const current = latest.current.viewport;
			const anchor = sizes
				? { x: sizes.container.width / 2, y: sizes.container.height / 2 }
				: { x: 0, y: 0 };
			const next = zoomAt(
				current,
				anchor,
				stepScale(current.scale, direction, limits),
				limits,
			);
			apply(next, { animate: true, user: true });
			announceZoom(next.scale);
		},
		[announceZoom, apply, limits, measure],
	);

	const fitToWindow = useCallback(() => {
		refit({ animate: true });
		announceZoom(latest.current.viewport.scale);
	}, [announceZoom, refit]);

	useImperativeHandle(
		ref,
		() => ({
			fit: fitToWindow,
			zoomIn: () => zoomBy(1),
			zoomOut: () => zoomBy(-1),
			setViewport: (next) => apply(next, { user: true }),
			getViewport: () => latest.current.viewport,
		}),
		[apply, fitToWindow, zoomBy],
	);

	useCanvasGestures({
		element: viewportRef,
		scope: rootRef,
		getViewport: () => latest.current.viewport,
		setViewport: (next) => apply(next, { user: true }),
		limits,
	});

	// 没有给出初始视口：挂载后适应窗口，窗口或内容尺寸变化时重新适应，直到用户调整过
	useLayoutEffect(() => {
		if (!adjusted.current) refit();
	}, [refit]);
	useEffect(() => {
		const viewportElement = viewportRef.current;
		const contentElement = contentRef.current;
		if (!viewportElement || !contentElement || typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(() => {
			if (!adjusted.current) refit();
		});
		observer.observe(viewportElement);
		observer.observe(contentElement);
		return () => observer.disconnect();
	}, [refit]);

	// 看板拖到边缘时请求平移：同步更新画面，看板紧接着就要按新位置量落点；开始编辑后不再随内容尺寸自动适应
	useEffect(() => {
		const root = rootRef.current;
		if (!root) return;
		const onPan = (event: Event) => {
			event.stopPropagation();
			const { dx, dy } = (event as CustomEvent<PanRequest>).detail;
			const sizes = measure();
			const content = contentRef.current;
			if (!sizes || !content) return;
			const margin = latest.current.fitOptions?.padding ?? DEFAULT_FIT_PADDING;
			const next = panWithin(
				latest.current.viewport,
				sizes.container,
				sizes.bounds,
				dx,
				dy,
				margin,
			);
			if (sameViewport(latest.current.viewport, next)) return;
			event.preventDefault();
			apply(next, { user: true });
			// 不等 React 提交；先挂起过渡，免得上一次按钮缩放留下的过渡把这一帧拖慢
			content.style.transition = "none";
			content.style.transform = transformOf(next);
			content.getBoundingClientRect();
			content.style.transition = "";
		};
		const onEditing = (event: Event) => {
			event.stopPropagation();
			adjusted.current = true;
		};
		root.addEventListener(PAN_EVENT, onPan);
		root.addEventListener(EDITING_EVENT, onEditing);
		return () => {
			root.removeEventListener(PAN_EVENT, onPan);
			root.removeEventListener(EDITING_EVENT, onEditing);
		};
	}, [apply, measure]);

	// 聚焦到视口之外的元素：平移到刚好露出，聚焦环不被视口边缘裁剪
	useEffect(() => {
		const target = viewportRef.current;
		if (!target) return;
		const onFocusIn = (event: FocusEvent) => {
			const element = event.target as HTMLElement;
			const content = contentRef.current;
			const sizes = measure();
			if (element === target || !sizes || !content) return;
			// 缩放过渡进行到一半时元素停在中间帧；先落到终点再量，平移量才对得上要写入的目标视口
			content.style.transition = "none";
			const box = target.getBoundingClientRect();
			const rect = element.getBoundingClientRect();
			content.style.transition = "";
			const next = revealRect(
				latest.current.viewport,
				sizes.container,
				{
					left: rect.left - box.left,
					top: rect.top - box.top,
					right: rect.right - box.left,
					bottom: rect.bottom - box.top,
				},
				REVEAL_MARGIN,
			);
			// 浏览器聚焦时按元素原本的布局位置滚动页面，可它已被视口裁剪、很快又被我们平移走，页面只会无故跳开：
			// 下一帧撤回这次滚动，再按平移之后的位置做让它露出的最小滚动
			const { x, y } = known;
			apply(next, { user: true });
			frame = requestAnimationFrame(() => {
				if (window.scrollX !== x || window.scrollY !== y)
					window.scrollTo({ left: x, top: y, behavior: "instant" });
				element.scrollIntoView?.({ block: "nearest", inline: "nearest" });
			});
		};
		// 浏览器先滚动页面、再触发 focusin，这时 window.scrollY 已经是被滚走的位置；
		// scroll 事件要到下一帧才触发，所以这里记下的是滚走之前的位置
		const known = { x: window.scrollX, y: window.scrollY };
		const onScroll = () => {
			known.x = window.scrollX;
			known.y = window.scrollY;
		};
		let frame = 0;
		window.addEventListener("scroll", onScroll, { passive: true });
		target.addEventListener("focusin", onFocusIn);
		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener("scroll", onScroll);
			target.removeEventListener("focusin", onFocusIn);
		};
	}, [apply, measure]);

	const changeFullscreen = useCallback((next: boolean) => {
		setFullscreen(next);
		setStatus(
			next
				? latest.current.messages.fullscreenEntered
				: latest.current.messages.fullscreenExited,
		);
		latest.current.onFullscreenChange?.(next);
	}, []);

	useInertOutside(rootRef, fullscreen);

	// 全屏：锁住页面滚动；Esc 退出（已被拖拽或键盘拿起接管的 Esc 不会走到这里）
	useEffect(() => {
		if (!fullscreen) return;
		const previous = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		const onKeyDown = (event: globalThis.KeyboardEvent) => {
			if (event.key === "Escape" && !event.defaultPrevented) changeFullscreen(false);
		};
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.body.style.overflow = previous;
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [fullscreen, changeFullscreen]);

	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		// 内容里的元素自己处理自己的按键；带修饰键的组合留给浏览器与页面
		if (event.target !== event.currentTarget) return;
		if (event.ctrlKey || event.metaKey || event.altKey) return;
		const step = event.shiftKey ? KEY_PAN * 4 : KEY_PAN;
		const pan: Record<string, [number, number]> = {
			ArrowLeft: [step, 0],
			ArrowRight: [-step, 0],
			ArrowUp: [0, step],
			ArrowDown: [0, -step],
		};
		const delta = pan[event.key];
		if (delta) {
			event.preventDefault();
			apply(panBy(latest.current.viewport, delta[0], delta[1]), { user: true });
		} else if (event.key === "+" || event.key === "=") {
			event.preventDefault();
			zoomBy(1);
		} else if (event.key === "-" || event.key === "_") {
			event.preventDefault();
			zoomBy(-1);
		} else if (event.key === "0") {
			event.preventDefault();
			fitToWindow();
		}
	};

	const { viewport, animate } = view;
	const atMax = viewport.scale >= limits.max;
	const atMin = viewport.scale <= limits.min;
	return (
		<div
			ref={rootRef}
			className={className ? `v-kanban-canvas ${className}` : "v-kanban-canvas"}
			data-fullscreen={fullscreen ? "true" : undefined}
			{...rest}
		>
			<div
				ref={viewportRef}
				role="group"
				data-kanban-pan-region=""
				aria-label={messages.canvasLabel}
				aria-describedby={hintId}
				// biome-ignore lint/a11y/noNoninteractiveTabindex: 可平移缩放的视口要能聚焦，才能用方向键平移、+ 与 - 缩放
				tabIndex={0}
				className="v-kanban-canvas__viewport"
				onKeyDown={onKeyDown}
			>
				<div
					ref={contentRef}
					className="v-kanban-canvas__content"
					data-animate={animate ? "true" : undefined}
					style={{
						transform: transformOf(viewport),
					}}
				>
					{children}
				</div>
			</div>
			{controls ? (
				<div
					role="group"
					aria-label={messages.controlsLabel}
					className="v-kanban-canvas__controls"
				>
					<button
						type="button"
						className="v-kanban-canvas__button"
						aria-label={messages.zoomOut}
						title={messages.zoomOut}
						aria-disabled={atMin}
						onClick={() => zoomBy(-1)}
					>
						<Icon>
							<path d="M3 8h10" />
						</Icon>
					</button>
					<span className="v-kanban-canvas__zoom">
						{Math.round(viewport.scale * 100)}%
					</span>
					<button
						type="button"
						className="v-kanban-canvas__button"
						aria-label={messages.zoomIn}
						title={messages.zoomIn}
						aria-disabled={atMax}
						onClick={() => zoomBy(1)}
					>
						<Icon>
							<path d="M3 8h10M8 3v10" />
						</Icon>
					</button>
					<button
						type="button"
						className="v-kanban-canvas__button"
						aria-label={messages.fit}
						title={messages.fit}
						onClick={fitToWindow}
					>
						<Icon>
							<path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />
						</Icon>
					</button>
					<button
						type="button"
						className="v-kanban-canvas__button"
						aria-label={fullscreen ? messages.exitFullscreen : messages.enterFullscreen}
						title={fullscreen ? messages.exitFullscreen : messages.enterFullscreen}
						onClick={() => changeFullscreen(!fullscreen)}
					>
						<Icon>
							{fullscreen ? (
								<path d="M13.5 6.5h-4v-4M9.5 6.5l4-4M2.5 9.5h4v4M6.5 9.5l-4 4" />
							) : (
								<path d="M9.5 2.5h4v4M13.5 2.5l-4 4M6.5 13.5h-4v-4M2.5 13.5l4-4" />
							)}
						</Icon>
					</button>
				</div>
			) : null}
			<span id={hintId} className="v-kanban-canvas__sr-only">
				{messages.canvasHint}
			</span>
			<div
				role="status"
				aria-live="polite"
				aria-atomic="true"
				className="v-kanban-canvas__sr-only v-kanban-canvas__status"
			>
				{status}
			</div>
		</div>
	);
}
