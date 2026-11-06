import { cn } from "cn";
import { Slot } from "radix-ui";
import { composeEventHandlers, useComposedRefs, useControllableState } from "radix-ui/internal";
import {
	type ComponentProps,
	type CSSProperties,
	createContext,
	type FocusEvent,
	type MouseEvent,
	type ReactNode,
	type RefObject,
	useContext,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { type Anchor, chooseAnchor } from "./anchor";
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
	/** 触发器与面板的 id 由根生成：服务端首帧就能互相引用，不依赖客户端才有的节点。 */
	triggerId: string;
	contentId: string;
	handoff: RefObject<Handoff | null>;
	trigger: HTMLElement | null;
	setTrigger: (node: HTMLElement | null) => void;
}

const MorphContext = createContext<MorphContextValue | null>(null);

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
 * 触发它的按钮本身长成面板：外形从按钮的位置、大小与圆角长出，内容晚一拍浮现，收起时原路缩回。
 * 只给小而独立的按钮用；根是触发器与面板共同的定位参照。
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
	const rootRef = useRef<HTMLSpanElement | null>(null);
	const composedRef = useComposedRefs(ref, rootRef);
	const triggerId = useId();
	const contentId = useId();
	const handoff = useRef<Handoff | null>(null);

	// Esc 与点击根之外收起；点到别处的可聚焦元素时，焦点留在那里。
	useEffect(() => {
		if (!open) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			event.preventDefault();
			setOpen(false);
		};
		const onPointerDown = (event: PointerEvent) => {
			if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
		};
		// 捕获阶段监听、且不看 defaultPrevented：站点根上常驻的 Radix 层会先把每个 Esc 标成已处理
		document.addEventListener("keydown", onKeyDown, true);
		document.addEventListener("pointerdown", onPointerDown);
		return () => {
			document.removeEventListener("keydown", onKeyDown, true);
			document.removeEventListener("pointerdown", onPointerDown);
		};
	}, [open, setOpen]);

	// 收起时焦点还在面板里（或已无处可去）就回到触发器。
	const wasOpen = useRef(open);
	useLayoutEffect(() => {
		const closing = wasOpen.current && !open;
		wasOpen.current = open;
		if (!closing) return;
		const active = document.activeElement;
		if (!active || active === document.body || rootRef.current?.contains(active)) {
			trigger?.focus({ preventScroll: true });
		}
	}, [open, trigger]);

	const context = useMemo(
		() => ({ open, setOpen, triggerId, contentId, handoff, trigger, setTrigger }),
		[open, setOpen, triggerId, contentId, trigger],
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
					if (open && next && !event.currentTarget.contains(next as Node)) setOpen(false);
				})}
			/>
		</MorphContext.Provider>
	);
}

/** 触发器：必须是一个有底色的胶囊或圆钮，透明的图标按钮长不出来。 */
function MorphingPopoverTrigger({
	asChild,
	ref,
	onClick,
	tabIndex,
	...props
}: ComponentProps<"button"> & { asChild?: boolean }) {
	const { open, setOpen, triggerId, contentId, setTrigger } = useMorph("MorphingPopoverTrigger");
	const composedRef = useComposedRefs(ref, setTrigger);
	const Component = asChild ? Slot.Root : "button";

	return (
		<Component
			type={asChild ? undefined : "button"}
			data-slot="morphing-popover-trigger"
			data-state={open ? "open" : "closed"}
			id={triggerId}
			aria-expanded={open}
			aria-controls={contentId}
			// 展开时它被面板盖住，焦点已交给面板；收起后恢复
			tabIndex={open ? -1 : tabIndex}
			{...props}
			ref={composedRef}
			onClick={composeEventHandlers(onClick, (event: MouseEvent<HTMLButtonElement>) => {
				if (!event.defaultPrevented) setOpen(!open);
			})}
		/>
	);
}

/** 面板的属性；`role` 默认 dialog，状态卡之类取 dialog，表情条之类取 listbox。`id` 由根生成，供触发器的 `aria-controls` 引用。 */
interface MorphingPopoverContentProps extends Omit<ComponentProps<"div">, "id"> {
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
	onClick,
	ref,
	...props
}: MorphingPopoverContentProps) {
	const { open, setOpen, triggerId, contentId, trigger, handoff } =
		useMorph("MorphingPopoverContent");
	const openRef = useRef(open);
	useLayoutEffect(() => {
		openRef.current = open;
	});
	/** 本面板最近处理过的 open；挂载时那一次由挂载 effect 负责，不算展开与收起的切换。 */
	const wasOpen = useRef(open);
	const layerRef = useRef<HTMLDivElement | null>(null);
	const shadowRef = useRef<HTMLDivElement | null>(null);
	const panelRef = useRef<HTMLDivElement | null>(null);
	const ghostRef = useRef<HTMLDivElement | null>(null);
	const bodyRef = useRef<HTMLDivElement | null>(null);
	const morphRef = useRef<Morph | null>(null);
	const composedRef = useComposedRefs(ref, panelRef);
	// 收起后先留着面板播完退场，再卸载。
	const [mounted, setMounted] = useState(open);
	if (open && !mounted) setMounted(true);

	// 挂载：定锚点与副本的位置；能变形就从触发器（接力时从旧面板）长出来，否则由 CSS 直接淡入。
	useLayoutEffect(() => {
		const layer = layerRef.current;
		const panel = panelRef.current;
		const shadow = shadowRef.current;
		const body = bodyRef.current;
		const ghostNode = ghostRef.current;
		if (!mounted || !layer || !panel || !shadow || !body || !ghostNode) return;
		const relay = handoff.current;
		handoff.current = null;
		const anchor =
			relay?.anchor ??
			(trigger
				? chooseAnchor(
						trigger.getBoundingClientRect(),
						panel.getBoundingClientRect(),
						{ width: window.innerWidth, height: window.innerHeight },
						outset,
					)
				: "top left");
		layer.dataset.anchor = anchor;
		if (!trigger) {
			layer.dataset.motion = "fade";
			return;
		}

		const from = relay?.shape ?? shapeOf(trigger);
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
	}, [mounted, trigger, radius, outset, handoff]);

	// 展开中再收起、收起中再展开，都由外形从当前形状接着走。
	useLayoutEffect(() => {
		if (wasOpen.current === open) return;
		wasOpen.current = open;
		const morph = morphRef.current;
		const layer = layerRef.current;
		const panel = panelRef.current;
		if (!morph || !trigger || !layer || !panel) return;
		if (open) {
			morph.expand();
		} else if (!canMorph(panel)) {
			// 展开之后才开启减弱动态：不再播变形，交给 CSS 淡出，卸载由下面的计时负责
			morph.dispose();
			morphRef.current = null;
			layer.dataset.motion = "fade";
		} else {
			morph.collapse(shapeOf(trigger), () => setMounted(false));
		}
	}, [open, trigger]);

	useEffect(() => {
		if (open || !mounted || morphRef.current) return;
		const timer = setTimeout(() => setMounted(false), FADE_MS);
		return () => clearTimeout(timer);
	}, [open, mounted]);

	// 展开后焦点进入面板：第一个能 Tab 到的控件，没有就落在面板本身。
	useLayoutEffect(() => {
		if (!open || !mounted) return;
		const target = bodyRef.current?.querySelector<HTMLElement>(TABBABLE) ?? panelRef.current;
		target?.focus({ preventScroll: true });
	}, [open, mounted]);

	if (!mounted) return null;

	// 没有自己的名称时以触发器命名；aria-labelledby 是全局属性，经对象展开声明以绕开按角色检查的静态规则。
	const labelledBy =
		props["aria-label"] === undefined
			? { "aria-labelledby": trigger?.id ?? triggerId }
			: undefined;

	return (
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
}

export {
	MorphingPopover,
	MorphingPopoverContent,
	type MorphingPopoverContentProps,
	type MorphingPopoverProps,
	MorphingPopoverTrigger,
};
