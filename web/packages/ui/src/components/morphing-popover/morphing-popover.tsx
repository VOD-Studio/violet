import { cn } from "cn";
import { Slot } from "radix-ui";
import { composeEventHandlers, useComposedRefs, useControllableState } from "radix-ui/internal";
import {
	type ComponentProps,
	type CSSProperties,
	createContext,
	type Dispatch,
	type FocusEvent,
	type MouseEvent,
	type ReactNode,
	type RefObject,
	type SetStateAction,
	useCallback,
	useContext,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { type Anchor, chooseAnchor, VIEWPORT_MARGIN } from "./anchor";
import { canMorph, createMorph, type Morph, type Shape, shapeOf } from "./morph";

/** 不做变形时（减弱动态、不支持 Web Animations）面板直接淡入淡出的时长。 */
const FADE_MS = 100;

const TABBABLE = [
	"a[href]",
	"button:not(:disabled)",
	'input:not(:disabled):not([type="hidden"])',
	"select:not(:disabled)",
	"textarea:not(:disabled)",
	"[tabindex]",
]
	.map((selector) => `${selector}:not([tabindex="-1"])`)
	.join(",");

/** 接力时被换掉的面板留给下一块的东西：此刻的外形，以及固定触发器的哪个角。 */
interface Handoff {
	/** 播放变形时才有；减弱动态下接力只沿用锚点。 */
	shape: Shape | null;
	anchor: Anchor;
}

interface MorphContextValue {
	open: boolean;
	setOpen: (open: boolean) => void;
	/** 未声明独立 Anchor 时，单触发器与面板在服务端即可互相引用。 */
	triggerId: string;
	contentId: string;
	handoff: RefObject<Handoff | null>;
	content: RefObject<HTMLDivElement | null>;
	trigger: HTMLElement | null;
	setTrigger: Dispatch<SetStateAction<HTMLElement | null>>;
	anchor: HTMLElement | null;
	setAnchor: (node: HTMLElement | null) => void;
	sourceHidden: boolean;
	setPresent: (present: boolean) => void;
}

const MorphContext = createContext<MorphContextValue | null>(null);
const CompositeAnchorContext = createContext(false);

function useMorph(part: string): MorphContextValue {
	const context = useContext(MorphContext);
	if (!context) throw new Error(`${part} 必须放在 MorphingPopover 内`);
	return context;
}

/** 根的属性：受控 `open`、`defaultOpen` 与 `onOpenChange`，其余落在外层 span 上。 */
interface MorphingPopoverProps extends Omit<ComponentProps<"span">, "defaultValue"> {
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
}

/**
 * 胶囊长成面板；独立 Anchor 可容纳多个触发按钮，根是几何源与面板共同的定位参照。
 */
function MorphingPopover({
	open: openProp,
	defaultOpen = false,
	onOpenChange,
	className,
	onBlur,
	ref,
	...props
}: MorphingPopoverProps) {
	const [open = false, setOpen] = useControllableState({
		prop: openProp,
		defaultProp: defaultOpen,
		onChange: onOpenChange,
	});
	const [trigger, setTrigger] = useState<HTMLElement | null>(null);
	const [anchor, setAnchor] = useState<HTMLElement | null>(null);
	const [present, setPresent] = useState(false);
	const sourceHidden = open || present;
	const rootRef = useRef<HTMLSpanElement | null>(null);
	const composedRef = useComposedRefs(ref, rootRef);
	const triggerId = useId();
	const contentId = useId();
	const handoff = useRef<Handoff | null>(null);
	const content = useRef<HTMLDivElement | null>(null);

	// Esc 与点击根之外收起；点到别处的可聚焦元素时，焦点留在那里。
	useEffect(() => {
		if (!open) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			event.preventDefault();
			setOpen(false);
		};
		const onPointerDown = (event: PointerEvent) => {
			const target = event.target as Node;
			if (!rootRef.current?.contains(target) && !content.current?.contains(target)) {
				setOpen(false);
			}
		};
		// 捕获阶段监听、且不看 defaultPrevented：站点根上常驻的 Radix 层会先把每个 Esc 标成已处理
		document.addEventListener("keydown", onKeyDown, true);
		document.addEventListener("pointerdown", onPointerDown);
		return () => {
			document.removeEventListener("keydown", onKeyDown, true);
			document.removeEventListener("pointerdown", onPointerDown);
		};
	}, [open, setOpen]);

	// 独立 Anchor 在退场结束前仍不可操作，恢复可见性后才能归还焦点。
	const wasOpen = useRef(open);
	const restoreFocus = useRef(false);
	useLayoutEffect(() => {
		if (wasOpen.current && !open) restoreFocus.current = true;
		if (open) restoreFocus.current = false;
		wasOpen.current = open;
		if (!restoreFocus.current || (anchor && sourceHidden)) return;
		restoreFocus.current = false;
		const active = document.activeElement;
		if (
			!active ||
			active === document.body ||
			rootRef.current?.contains(active) ||
			content.current?.contains(active)
		) {
			trigger?.focus({ preventScroll: true });
		}
	}, [open, trigger, anchor, sourceHidden]);

	const context = useMemo(
		() => ({
			open,
			setOpen,
			triggerId,
			contentId,
			handoff,
			content,
			trigger,
			setTrigger,
			anchor,
			setAnchor,
			sourceHidden,
			setPresent,
		}),
		[open, setOpen, triggerId, contentId, trigger, anchor, sourceHidden],
	);

	return (
		<MorphContext.Provider value={context}>
			<span
				data-slot="morphing-popover"
				{...props}
				ref={composedRef}
				className={cn("v-morph", className)}
				onBlur={composeEventHandlers(onBlur, (event: FocusEvent<HTMLSpanElement>) => {
					const next = event.relatedTarget;
					if (
						open &&
						next &&
						!event.currentTarget.contains(next as Node) &&
						!content.current?.contains(next as Node)
					) {
						setOpen(false);
					}
				})}
			/>
		</MorphContext.Provider>
	);
}

/** 独立形变源的属性；asChild 将尺寸、底色、ref 与隐藏状态交给唯一非交互子元素。 */
interface MorphingPopoverAnchorProps extends ComponentProps<"span"> {
	asChild?: boolean;
}

/**
 * 注册有真实尺寸与底色的整枚胶囊；内部可放多个 Trigger，不额外创建交互元素。
 *
 * @remarks 展开与收回期间保留布局，但整体隐藏并 inert；Content 必须放在 Anchor 外。
 */
function MorphingPopoverAnchor({ asChild, ref, children, ...props }: MorphingPopoverAnchorProps) {
	const { triggerId, setAnchor, sourceHidden } = useMorph("MorphingPopoverAnchor");
	const composedRef = useComposedRefs(ref, setAnchor);
	const Component = asChild ? Slot.Root : "span";
	return (
		<CompositeAnchorContext.Provider value={true}>
			<Component
				id={triggerId}
				{...props}
				ref={composedRef}
				data-slot="morphing-popover-anchor"
				data-hidden={sourceHidden ? "" : undefined}
				inert={sourceHidden || props.inert}
			>
				{children}
			</Component>
		</CompositeAnchorContext.Provider>
	);
}

/** 触发按钮；无独立 Anchor 时自身须为有底色的胶囊或圆钮。 */
function MorphingPopoverTrigger({
	asChild,
	ref,
	onClick,
	tabIndex,
	...props
}: ComponentProps<"button"> & { asChild?: boolean }) {
	const { open, setOpen, triggerId, contentId, setTrigger } = useMorph("MorphingPopoverTrigger");
	const composite = useContext(CompositeAnchorContext);
	const id = useId();
	const nodeRef = useRef<HTMLElement | null>(null);
	const register = useCallback(
		(node: HTMLElement | null) => {
			// 外部 inline ref 重组会临时 detach；这不代表按钮卸载。
			if (!node) return;
			const previous = nodeRef.current;
			nodeRef.current = node;
			setTrigger((current) => (current === previous ? node : (current ?? node)));
		},
		[setTrigger],
	);
	useLayoutEffect(() => {
		const node = nodeRef.current;
		if (node) setTrigger((current) => current ?? node);
		return () => {
			const removed = nodeRef.current;
			setTrigger((current) => (current === removed ? null : current));
		};
	}, [setTrigger]);
	const composedRef = useComposedRefs(ref, register);
	const Component = asChild ? Slot.Root : "button";

	return (
		<Component
			type={asChild ? undefined : "button"}
			data-slot="morphing-popover-trigger"
			data-state={open ? "open" : "closed"}
			id={composite ? id : triggerId}
			aria-expanded={open}
			aria-controls={contentId}
			// 展开时它被面板盖住，焦点已交给面板；收起后恢复
			tabIndex={open ? -1 : tabIndex}
			{...props}
			ref={composedRef}
			onClick={(event: MouseEvent<HTMLButtonElement>) => {
				// 即便宿主取消默认切换并自行选择面板，也记住真正按下的按钮。
				setTrigger(event.currentTarget);
				onClick?.(event);
				if (!event.defaultPrevented) setOpen(!open);
			}}
		/>
	);
}

/** 面板的属性；`role` 默认 dialog，状态卡之类取 dialog，表情条之类取 listbox。`id` 由根生成，供触发器的 `aria-controls` 引用。 */
interface MorphingPopoverContentProps extends Omit<ComponentProps<"div">, "id"> {
	/** 将面板移出滚动祖先；默认原位渲染。 */
	portal?: boolean;
	/** Portal 挂载点，默认触发器文档的 body；局部主题容器须无裁剪、无变换。 */
	container?: HTMLElement | null;
	/** 面板展开后的圆角；单行的条取它高度的一半，多行的面板取 16。 */
	radius?: number;
	/** 面板的角比触发器的角外扩多少 px；单行的条取 6，让第一个图标与触发器上的图标对齐。 */
	outset?: number;
	/**
	 * 起点那张东西的副本，按最终大小排在面板里、对读屏隐藏：外形长出时它模糊淡出，
	 * 收起的最后一段浮现，触发器上的字不会在长出的一瞬消失。省略时这个位置是空的，字在长出的一瞬消失。
	 * 副本落在触发器原来的位置，点它收起；接力的面板里它是旧面板的内容，不可点。
	 */
	ghost?: ReactNode;
	/** 副本所在层的类名；副本压在内容上方，内容在那个位置有可点控件时用 `pointer-events-none` 放行。 */
	ghostClassName?: string;
}

/** 面板：盖住触发器，外形从触发器长出；没有名称时以触发器命名。 */
function MorphingPopoverContent({
	className,
	children,
	role = "dialog",
	radius = 16,
	outset = 0,
	ghost,
	ghostClassName,
	portal = false,
	container,
	onClick,
	ref,
	...props
}: MorphingPopoverContentProps) {
	const {
		open,
		setOpen,
		triggerId,
		contentId,
		trigger,
		anchor: sourceAnchor,
		handoff,
		content,
		setPresent,
	} = useMorph("MorphingPopoverContent");
	const source = sourceAnchor ?? trigger;
	const openRef = useRef(open);
	useLayoutEffect(() => {
		openRef.current = open;
	});
	/** 本面板最近处理过的 open；挂载时那一次由挂载 effect 负责，不算展开与收起的切换。 */
	const wasOpen = useRef(open);
	const layerRef = useRef<HTMLDivElement | null>(null);
	const portalRef = useRef<HTMLDivElement | null>(null);
	const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
	const shadowRef = useRef<HTMLDivElement | null>(null);
	const panelRef = useRef<HTMLDivElement | null>(null);
	const ghostRef = useRef<HTMLDivElement | null>(null);
	const bodyRef = useRef<HTMLDivElement | null>(null);
	const morphRef = useRef<Morph | null>(null);
	const composedRef = useComposedRefs(ref, panelRef, content);
	// 收起后先留着面板播完退场，再卸载。
	const [mounted, setMounted] = useState(open);
	if (open && !mounted) setMounted(true);
	useLayoutEffect(() => {
		setPresent(mounted);
		return () => setPresent(false);
	}, [mounted, setPresent]);

	useLayoutEffect(() => {
		if (portal && mounted) {
			setPortalTarget(container ?? source?.ownerDocument.body ?? document.body);
		}
	}, [portal, mounted, container, source]);

	// 固定定位的几何副本留在门户中，原触发器仍占据原来的布局位置。
	useLayoutEffect(() => {
		const node = portalRef.current;
		if (!portal || !portalTarget || !mounted || !source || !node) return;
		const updatePosition = () => {
			const box = source.getBoundingClientRect();
			node.style.left = `${box.left}px`;
			node.style.top = `${box.top}px`;
			node.style.width = `${box.width}px`;
			node.style.height = `${box.height}px`;
		};
		const updateAppearance = () => {
			if (source.closest('[data-motion="reduce"]')) {
				node.dataset.motion = "reduce";
			} else {
				delete node.dataset.motion;
			}
		};
		updatePosition();
		updateAppearance();
		const owner = source.ownerDocument;
		const view = owner.defaultView;
		owner.addEventListener("scroll", updatePosition, true);
		view?.addEventListener("resize", updatePosition);
		const resize = new ResizeObserver(updatePosition);
		resize.observe(source);
		const appearance = new MutationObserver(updateAppearance);
		for (
			let ancestor: HTMLElement | null = source;
			ancestor;
			ancestor = ancestor.parentElement
		) {
			appearance.observe(ancestor, {
				attributes: true,
				attributeFilter: ["data-motion"],
			});
		}
		return () => {
			owner.removeEventListener("scroll", updatePosition, true);
			view?.removeEventListener("resize", updatePosition);
			resize.disconnect();
			appearance.disconnect();
		};
	}, [portal, portalTarget, mounted, source]);

	// 挂载：定锚点与副本的位置；能变形就从触发器（接力时从旧面板）长出来，否则由 CSS 直接淡入。
	// biome-ignore lint/correctness/useExhaustiveDependencies: portalTarget 就绪后需重新定锚与起变形，不能仅按函数体引用判定。
	useLayoutEffect(() => {
		const layer = layerRef.current;
		const panel = panelRef.current;
		const shadow = shadowRef.current;
		const body = bodyRef.current;
		const ghostNode = ghostRef.current;
		if (!mounted || !layer || !panel || !shadow || !body || !ghostNode) return;
		const relay = handoff.current;
		handoff.current = null;
		const viewport = {
			width: document.documentElement.clientWidth || window.innerWidth,
			height: window.innerHeight,
		};
		layer.style.setProperty(
			"--v-morph-available-inline-size",
			`${viewport.width - 2 * VIEWPORT_MARGIN}px`,
		);
		const anchor = source
			? chooseAnchor(
					source.getBoundingClientRect(),
					panel.getBoundingClientRect(),
					viewport,
					outset,
					relay?.anchor,
				)
			: "top left";
		layer.dataset.anchor = anchor;
		layer.style.translate = "";
		const target = panel.getBoundingClientRect();
		if (target.width > 0) {
			const left = Math.max(
				VIEWPORT_MARGIN,
				Math.min(target.left, viewport.width - target.width - VIEWPORT_MARGIN),
			);
			const offset = left - target.left;
			if (offset !== 0) {
				// DOMRect 已包含宿主缩放，translate 使用未缩放的局部坐标。
				const scaleX = target.width / panel.offsetWidth;
				layer.style.translate = `${offset / scaleX}px 0`;
			}
		}
		if (!source) {
			layer.dataset.motion = "fade";
			return;
		}

		const from = relay?.shape ?? shapeOf(source);
		const box = panel.getBoundingClientRect();
		ghostNode.dataset.from = relay ? "panel" : "trigger";
		ghostNode.style.left = `${from.left - box.left}px`;
		ghostNode.style.top = `${from.top - box.top}px`;
		ghostNode.style.width = `${from.width}px`;
		ghostNode.style.height = `${from.height}px`;

		if (!canMorph(panel)) {
			layer.dataset.motion = "fade";
			return () => {
				if (openRef.current) handoff.current = { shape: null, anchor };
			};
		}
		layer.dataset.motion = "morph";
		const morph = createMorph({
			panel,
			shadow,
			body,
			ghost: { element: ghostNode, returns: !relay },
			radius,
		});
		morphRef.current = morph;
		// 这次挂载已经按展开处理，下面的切换 effect 不要再当成重新展开。
		wasOpen.current = openRef.current;
		morph.expand(from);
		return () => {
			// 面板还开着就被另一块换掉是接力：把此刻的外形与锚点交给下一块。
			if (openRef.current) handoff.current = { shape: morph.shape(), anchor };
			morph.dispose();
			morphRef.current = null;
		};
	}, [mounted, source, radius, outset, handoff, portalTarget]);

	// 展开中再收起、收起中再展开，都由外形从当前形状接着走。
	useLayoutEffect(() => {
		if (wasOpen.current === open) return;
		wasOpen.current = open;
		const morph = morphRef.current;
		const layer = layerRef.current;
		const panel = panelRef.current;
		if (!morph || !source || !layer || !panel) return;
		if (open) {
			morph.expand();
		} else if (!canMorph(panel)) {
			// 展开之后才开启减弱动态：不再播变形，交给 CSS 淡出，卸载由下面的计时负责
			morph.dispose();
			morphRef.current = null;
			layer.dataset.motion = "fade";
		} else {
			morph.collapse(shapeOf(source), () => setMounted(false));
		}
	}, [open, source]);

	useEffect(() => {
		if (open || !mounted || morphRef.current) return;
		const timer = setTimeout(() => setMounted(false), FADE_MS);
		return () => clearTimeout(timer);
	}, [open, mounted]);

	// 展开后焦点进入面板：第一个能 Tab 到的控件，没有就落在面板本身。
	// biome-ignore lint/correctness/useExhaustiveDependencies: portalTarget 就绪后需把焦点移入已挂载的面板。
	useLayoutEffect(() => {
		if (!open || !mounted) return;
		const target = bodyRef.current?.querySelector<HTMLElement>(TABBABLE) ?? panelRef.current;
		target?.focus({ preventScroll: true });
	}, [open, mounted, portalTarget]);

	if (!mounted || (portal && !portalTarget)) return null;

	// 没有自己的名称时以触发器命名；aria-labelledby 是全局属性，经对象展开声明以绕开按角色检查的静态规则。
	const labelledBy =
		props["aria-label"] === undefined
			? { "aria-labelledby": trigger?.id ?? triggerId }
			: undefined;

	const layer = (
		<div
			ref={layerRef}
			className="v-morph__layer"
			data-state={open ? "open" : "closed"}
			style={
				{
					"--v-morph-radius": `${radius}px`,
					"--v-morph-outset": `${outset}px`,
				} as CSSProperties
			}
		>
			<div ref={shadowRef} className="v-morph__shadow" aria-hidden="true" />
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: 收起途中点面板重新展开只是指针的便捷入口，键盘用触发器 */}
			<div
				data-slot="morphing-popover-content"
				data-state={open ? "open" : "closed"}
				id={contentId}
				role={role}
				tabIndex={-1}
				{...labelledBy}
				{...props}
				ref={composedRef}
				className={cn("v-morph__panel", className)}
				// 收起途中面板还压在触发器上，指针点到的是它而不是被盖住的触发器：点一下再长出来
				onClick={composeEventHandlers(onClick, () => {
					if (!openRef.current) setOpen(true);
				})}
			>
				<div
					ref={ghostRef}
					aria-hidden="true"
					className={cn("v-morph__ghost", ghostClassName)}
					onClick={(event) => {
						if (event.currentTarget.dataset.from === "trigger") setOpen(false);
					}}
				>
					{ghost}
				</div>
				<div ref={bodyRef} className="v-morph__body">
					{children}
				</div>
			</div>
		</div>
	);
	if (!portal || !portalTarget) return layer;
	return createPortal(
		<div ref={portalRef} className="v-morph__portal">
			{layer}
		</div>,
		portalTarget,
	);
}

export {
	MorphingPopover,
	MorphingPopoverAnchor,
	type MorphingPopoverAnchorProps,
	MorphingPopoverContent,
	type MorphingPopoverContentProps,
	type MorphingPopoverProps,
	MorphingPopoverTrigger,
};
