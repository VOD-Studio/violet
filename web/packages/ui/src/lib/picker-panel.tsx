"use client";

import { cn } from "cn";
import { Check } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { useComposedRefs } from "radix-ui/internal";
import {
	type ComponentProps,
	createContext,
	type ReactNode,
	type RefObject,
	use,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { useListHighlight } from "../components/list-highlight/use-list-highlight";
import type { ListboxMode } from "./use-listbox";

/** 面板与锚点的间距，对应设计稿的 6px。 */
const SIDE_OFFSET = 6;

function PresenceProbe({ onChange }: { onChange: (present: boolean) => void }) {
	const ref = useRef(onChange);
	ref.current = onChange;
	useLayoutEffect(() => {
		ref.current(true);
		return () => ref.current(false);
	}, []);
	return null;
}

export interface PickerPanelProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** 定位与宽度的锚点：触发器或输入框外壳。面板与它同宽（最小 160px）。 */
	anchorRef: RefObject<HTMLElement | null>;
	/** 挂载 Portal 的容器；默认 `document.body`。陈列室舞台与带缩放的宿主需要传入。 */
	container?: HTMLElement | null;
	/** 判断「放不下」的边界；默认是视口。陈列室舞台里传舞台，面板就不会越出舞台。 */
	collisionBoundary?: Element | null;
	className?: string;
	children?: ReactNode;
	ref?: ComponentProps<"div">["ref"];
	id?: string;
	/** 面板定位完成，可以按高亮项滚动列表。 */
	onPlaced?: () => void;
	/** 面板从展开到退场完成期间的可见状态；退场中的副本不参与交互。 */
	onPresenceChange?: (present: boolean) => void;
}

/**
 * 选择器族的浮层外壳：展开时使用非模态 Radix Popover，退场时只保留不可交互的视觉副本。
 *
 * 焦点留在锚点内的触发器或输入框，用 `aria-activedescendant` 指向高亮项；打开与关闭时都不移动焦点，
 * 关闭后由调用方决定是否还焦点（Tab 离开时不还）。面板在下方起点对齐、距锚点 6px，放不下翻到上方。
 * Esc 在 Radix 的捕获阶段处理，不看 `defaultPrevented`：站点根上常驻的 Radix 层会先阻止默认行为。
 * 面板上的按下一律 `preventDefault`，选项与滚动条都不会让触发器失焦。
 */
export function PickerPanel({
	open,
	onOpenChange,
	anchorRef,
	container,
	collisionBoundary,
	className,
	children,
	ref,
	id,
	onPlaced,
	onPresenceChange,
}: PickerPanelProps) {
	const contentRef = useRef<HTMLDivElement | null>(null);
	const [showLayer, setShowLayer] = useState(open);
	const [exiting, setExiting] = useState(false);
	const clearExitRef = useRef<(() => void) | null>(null);
	useLayoutEffect(() => {
		if (open) {
			clearExitRef.current?.();
			setExiting(false);
			setShowLayer(true);
			return;
		}
		if (!showLayer) return;

		const wrapper = contentRef.current?.parentElement;
		if (wrapper) {
			// Popper 的外壳带有最终位置、宽度变量和缩放宿主的坐标系；复制它而不是重算定位。
			const snapshot = wrapper.cloneNode(true) as HTMLElement;
			snapshot.removeAttribute("id");
			for (const element of snapshot.querySelectorAll("[id]")) element.removeAttribute("id");
			snapshot.setAttribute("aria-hidden", "true");
			snapshot.inert = true;
			snapshot.classList.add("v-picker-exit");
			wrapper.parentElement?.append(snapshot);
			const panelSnapshot = snapshot.querySelector<HTMLElement>('[data-slot="picker-panel"]');
			const clear = () => {
				panelSnapshot?.removeEventListener("animationend", onAnimationEnd);
				panelSnapshot?.removeEventListener("animationcancel", onAnimationEnd);
				snapshot.remove();
				if (clearExitRef.current === clear) clearExitRef.current = null;
				setExiting(false);
			};
			const onAnimationEnd = (event: AnimationEvent) => {
				if (event.target === panelSnapshot) clear();
			};
			clearExitRef.current = clear;
			setExiting(true);
			panelSnapshot?.addEventListener("animationend", onAnimationEnd);
			panelSnapshot?.addEventListener("animationcancel", onAnimationEnd);
			const animationName = panelSnapshot
				? getComputedStyle(panelSnapshot).animationName
				: "";
			if (!animationName || animationName === "none") clear();
		}
		// 由 owner 直接卸下 forceMount Content，避免 Presence 等退场动画时留下 DismissableLayer。
		setShowLayer(false);
	}, [open, showLayer]);
	useEffect(() => () => clearExitRef.current?.(), []);
	// 面板挂在 body 上，在模态对话框的 Radix 滚动锁之外：锁会取消面板上的滚轮与触摸滚动。
	// 在面板上截住事件，不让它冒泡到锁挂在 document 上的监听。
	const [panel, setPanel] = useState<HTMLDivElement | null>(null);
	useEffect(() => {
		if (!panel) return;
		const stop = (event: Event) => event.stopPropagation();
		panel.addEventListener("wheel", stop);
		panel.addEventListener("touchmove", stop);
		return () => {
			panel.removeEventListener("wheel", stop);
			panel.removeEventListener("touchmove", stop);
		};
	}, [panel]);
	const composedRef = useComposedRefs(ref, contentRef, setPanel);
	const closeRef = useRef(onOpenChange);
	closeRef.current = onOpenChange;

	// 锚点被页面或某个滚动祖先带出视野时收起，与 Popover 单元一致
	useEffect(() => {
		const anchor = anchorRef.current;
		if (!open || !anchor || typeof IntersectionObserver === "undefined") return;
		const observer = new IntersectionObserver((entries) => {
			const latest = entries.at(-1);
			if (latest && !latest.isIntersecting) closeRef.current(false);
		});
		observer.observe(anchor);
		return () => observer.disconnect();
	}, [open, anchorRef]);

	// Popover 的类型没有公开 onPlaced，运行时原样交给 Popper.Content
	const placedProps = { onPlaced } as Record<string, unknown>;

	return (
		<PopoverPrimitive.Root open={open} onOpenChange={onOpenChange} modal={false}>
			<PopoverPrimitive.Anchor virtualRef={anchorRef as RefObject<HTMLElement>} />
			{onPresenceChange && (open || showLayer || exiting) ? (
				<PresenceProbe onChange={onPresenceChange} />
			) : null}
			{open || showLayer ? (
				<PopoverPrimitive.Portal container={container} forceMount>
					<PopoverPrimitive.Content
						forceMount
						data-slot="picker-panel"
						ref={composedRef}
						id={id}
						// 面板只是 listbox 的容器，不是对话框
						role="presentation"
						side="bottom"
						align="start"
						sideOffset={SIDE_OFFSET}
						collisionPadding={8}
						collisionBoundary={collisionBoundary}
						{...placedProps}
						onOpenAutoFocus={(event) => event.preventDefault()}
						onCloseAutoFocus={(event) => event.preventDefault()}
						onEscapeKeyDown={(event) => {
							event.preventDefault();
							onOpenChange(false);
						}}
						onInteractOutside={(event) => {
							const target = event.target;
							if (target instanceof Node && anchorRef.current?.contains(target)) {
								event.preventDefault();
							}
						}}
						onMouseDown={(event) => event.preventDefault()}
						className={cn("v-picker-panel v-float", className)}
					>
						{children}
					</PopoverPrimitive.Content>
				</PopoverPrimitive.Portal>
			) : null}
		</PopoverPrimitive.Root>
	);
}

export interface PickerListProps extends Omit<ComponentProps<"div">, "role"> {
	/** 引擎的 `mode`：键盘模式下悬停滑动的底色让位给行自身的 `data-kb` 底色。 */
	mode?: ListboxMode;
	multiselectable?: boolean;
}

/** 面板里的滚动区与 `role="listbox"`：最高 264px，带悬停滑动高亮。 */
export function PickerList({
	ref,
	className,
	mode = "pointer",
	multiselectable,
	...props
}: PickerListProps) {
	const highlight = useListHighlight<HTMLDivElement>();
	const composedRef = useComposedRefs(ref, highlight.ref);
	return (
		<div
			data-slot="picker-list"
			{...props}
			ref={composedRef}
			role="listbox"
			aria-multiselectable={multiselectable || undefined}
			data-mode={mode}
			className={cn("v-picker-list v-list-highlight", className)}
		/>
	);
}

const GroupContext = createContext<string | null>(null);

/** 选项分组：`role="group"`，名称取自里面的 `PickerLabel`。 */
export function PickerGroup({ className, ...props }: Omit<ComponentProps<"div">, "role">) {
	const labelId = useId();
	return (
		<GroupContext value={labelId}>
			<div
				data-slot="picker-group"
				{...props}
				role="group"
				aria-labelledby={labelId}
				className={cn("v-picker-group", className)}
			/>
		</GroupContext>
	);
}

/** 分组标签：12px 次级文字，组间只靠它上方的 8px 内边距区分，不画分割线。 */
export function PickerLabel({ className, ...props }: ComponentProps<"div">) {
	const labelId = use(GroupContext);
	return (
		<div
			data-slot="picker-label"
			id={labelId ?? undefined}
			{...props}
			className={cn("v-picker-label", className)}
		/>
	);
}

export interface PickerOptionProps extends Omit<ComponentProps<"div">, "children"> {
	children: ReactNode;
	/** 已选：墨色加粗。与 `aria-selected` 分开，后者在组合框里表示高亮。 */
	selected?: boolean;
	/** 选中标记：`check` 在右侧画对勾（单选），`checkbox` 在左侧画勾选框（多选），默认不画。 */
	indicator?: "check" | "checkbox";
	/** 32px 图标块，底色 `--muted`。 */
	icon?: ReactNode;
	/** 第二行说明，12px 次级文字；有说明的选项最小高度 48px。 */
	description?: ReactNode;
	/** 右侧附加信息，12px 次级文字。 */
	meta?: ReactNode;
	/** 标题文字所在节点，调用方据此读取选项的文字标签。 */
	textRef?: ComponentProps<"span">["ref"];
}

/** 选项行；`role`、`id`、`aria-*`、`data-active`、`data-kb` 与指针事件由引擎的 `getItemProps` 提供。 */
export function PickerOption({
	className,
	children,
	selected,
	indicator,
	icon,
	description,
	meta,
	textRef,
	...props
}: PickerOptionProps) {
	const title = (
		<span ref={textRef} className="v-picker-option__text">
			{children}
		</span>
	);
	return (
		<div
			data-slot="picker-option"
			data-list-highlight-item=""
			data-selected={selected ? "" : undefined}
			data-rich={description ? "" : undefined}
			{...props}
			className={cn("v-picker-option", className)}
		>
			{indicator === "checkbox" ? (
				<span className="v-picker-option__box" aria-hidden="true">
					<Check />
				</span>
			) : null}
			{icon ? (
				<span className="v-picker-option__tile" aria-hidden="true">
					{icon}
				</span>
			) : null}
			{description ? (
				<span className="v-picker-option__body">
					{title}
					<span className="v-picker-option__description">{description}</span>
				</span>
			) : (
				title
			)}
			{meta ? <span className="v-picker-option__meta">{meta}</span> : null}
			{indicator === "check" && selected ? (
				<Check className="v-picker-option__check" aria-hidden="true" />
			) : null}
		</div>
	);
}

/** 空态与加载态：16px 上下内边距、居中、14px 次级文字。 */
export function PickerEmpty({ className, ...props }: ComponentProps<"div">) {
	return <div data-slot="picker-empty" {...props} className={cn("v-picker-empty", className)} />;
}

/** 把 `text` 里第一处命中 `query` 的片段（不分大小写）包成 `<mark>`；未命中原样返回。 */
export function highlightMatch(text: string, query: string): ReactNode {
	const needle = query.trim().toLowerCase();
	if (!needle) return text;
	const start = text.toLowerCase().indexOf(needle);
	if (start < 0) return text;
	const end = start + needle.length;
	return (
		<>
			{text.slice(0, start)}
			<mark className="v-picker-mark">{text.slice(start, end)}</mark>
			{text.slice(end)}
		</>
	);
}
