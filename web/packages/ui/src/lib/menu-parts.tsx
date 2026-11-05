"use client";

import { cn } from "cn";
import { CheckIcon, ChevronRightIcon } from "lucide-react";
import type { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import { composeEventHandlers, useComposedRefs, useControllableState } from "radix-ui/internal";
import {
	type ComponentProps,
	type CSSProperties,
	createContext,
	isValidElement,
	type MutableRefObject,
	type PointerEvent,
	type ReactElement,
	type ReactNode,
	type Ref,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { pinyinInitials } from "./pinyin-initials";

/** 操作菜单与右键菜单共用的 Radix 菜单部件；两个单元的 Root、Trigger、Content 各自封装。 */
type MenuPrimitive = Pick<
	typeof DropdownMenuPrimitive,
	| "Group"
	| "Item"
	| "CheckboxItem"
	| "RadioGroup"
	| "RadioItem"
	| "ItemIndicator"
	| "Label"
	| "Separator"
	| "Sub"
	| "SubTrigger"
	| "SubContent"
>;

type MenuSlot = "dropdown-menu" | "context-menu";

/** 指针离开子菜单触发项后，往子菜单方向移动仍不收起的宽限。 */
const SUB_GRACE_MS = 120;

/**
 * 子菜单与父菜单面板外沿的水平间距 4，再加上触发项距面板外沿的内边距 6：
 * Radix 以触发项为锚点，不是以面板为锚点。
 */
const SUB_SIDE_OFFSET = 10;

interface GraceState {
	/** 离开触发项已超过宽限：之后指针进入别的项应立即接管焦点，由此收起子菜单。 */
	expired: boolean;
	timer: ReturnType<typeof setTimeout> | undefined;
}

const GraceContext = createContext<GraceState | null>(null);

interface SubState {
	triggerRef: MutableRefObject<HTMLElement | null>;
	isOpen: () => boolean;
	/** 只收起这一层子菜单，焦点回到触发项。 */
	close: () => void;
}

const SubContext = createContext<SubState | null>(null);

function createGrace(): GraceState {
	return { expired: false, timer: undefined };
}

function resetGrace(grace: GraceState | null) {
	if (!grace) return;
	clearTimeout(grace.timer);
	grace.timer = undefined;
	grace.expired = false;
}

/**
 * Radix 的指针宽限固定 300ms（内部硬编码，无法配置）：宽限内指针进入其他项时不会聚焦它。
 * 设计稿给的是 120ms，所以宽限过后由我们自己让该项接管焦点；
 * 宽限期内仍走 Radix 的「朝子菜单移动」判定。
 */
function useSubGrace(onPointerMove: ((event: PointerEvent<HTMLDivElement>) => void) | undefined) {
	const grace = useContext(GraceContext);
	return composeEventHandlers(onPointerMove, (event: PointerEvent<HTMLDivElement>) => {
		if (event.pointerType === "mouse" && grace?.expired) {
			event.currentTarget.focus({ preventScroll: true });
		}
	});
}

/** 面板内当前项的底色块：随悬停与键盘焦点滑动，几何由测量写入 CSS 变量。 */
interface HighlightMark {
	x: number;
	y: number;
	width: number;
	height: number;
	visible: boolean;
	/** 色块刚出现或刚从隐藏恢复：直接落位，不从旧位置滑过来。 */
	jump: boolean;
}

const ITEM_SELECTOR = '[role^="menuitem"]';

/** 面板的内部状态，由 {@link useMenuSurface} 创建、交给 {@link MenuSurfaceBody} 渲染。 */
export interface MenuSurface {
	ref: (node: HTMLDivElement | null) => void;
	onFocus: NonNullable<ComponentProps<"div">["onFocus"]>;
	mark: HighlightMark | null;
	grace: GraceState;
}

/**
 * 面板（含子菜单）共用的内部状态：当前项底色块、宽限计时。
 * 底色块依赖焦点：Radix 悬停时会聚焦项，离开项时把焦点还给面板，键盘也走同一条路径。
 */
export function useMenuSurface({
	ref,
	onFocus,
}: {
	ref?: Ref<HTMLDivElement>;
	onFocus?: ComponentProps<"div">["onFocus"];
}): MenuSurface {
	const surfaceRef = useRef<HTMLDivElement | null>(null);
	const composedRef = useComposedRefs(ref, surfaceRef);
	const [mark, setMark] = useState<HighlightMark | null>(null);
	const [grace] = useState(createGrace);

	useEffect(() => () => clearTimeout(grace.timer), [grace]);

	const handleFocus = composeEventHandlers(onFocus, (event: React.FocusEvent<HTMLDivElement>) => {
		const surface = surfaceRef.current;
		if (!surface || !(event.target instanceof HTMLElement)) return;
		// React 事件会穿过 Portal 与内嵌的子菜单冒泡上来，只处理本面板自己的项
		const owner = event.target.closest("[data-radix-menu-content]");
		if (owner !== surface) return;
		const item = event.target.closest<HTMLElement>(ITEM_SELECTOR);
		if (!item || item.hasAttribute("data-disabled")) {
			setMark((previous) => (previous?.visible ? { ...previous, visible: false } : previous));
			return;
		}
		// 用包围盒相减而不是 offsetTop：项可能在带自己定位或滚动的包裹元素里；同属一个变换，差值不受浮出动画影响
		const box = surface.getBoundingClientRect();
		const rect = item.getBoundingClientRect();
		setMark((previous) => ({
			x: rect.left - box.left - surface.clientLeft + surface.scrollLeft,
			y: rect.top - box.top - surface.clientTop + surface.scrollTop,
			width: rect.width,
			height: rect.height,
			visible: true,
			jump: !previous?.visible,
		}));
	});

	return { ref: composedRef, onFocus: handleFocus, mark, grace };
}

/** 面板内容：底色块与宽限上下文，放在 Content 的 children 最前。 */
export function MenuSurfaceBody({
	surface,
	children,
}: {
	surface: MenuSurface;
	children?: ReactNode;
}) {
	const { mark, grace } = surface;
	return (
		<GraceContext.Provider value={grace}>
			{mark && (
				<span
					aria-hidden="true"
					className="v-dropdown-menu__highlight"
					data-visible={mark.visible ? "true" : "false"}
					data-jump={mark.jump ? "true" : undefined}
					style={
						{
							"--v-menu-hl-x": `${mark.x}px`,
							"--v-menu-hl-y": `${mark.y}px`,
							"--v-menu-hl-w": `${mark.width}px`,
							"--v-menu-hl-h": `${mark.height}px`,
						} as CSSProperties
					}
				/>
			)}
			{children}
		</GraceContext.Provider>
	);
}

/** 各单元的 Shortcut 组件：它们的文字是快捷键提示，不属于项的标签。 */
const SHORTCUT_TYPES = new Set<unknown>();

/** 取项的文字标签：不含快捷键，供前缀预测输入匹配。 */
function labelText(node: ReactNode): string {
	if (typeof node === "string" || typeof node === "number") return String(node);
	if (Array.isArray(node)) return node.map(labelText).join("");
	if (isValidElement<{ children?: ReactNode }>(node) && !SHORTCUT_TYPES.has(node.type)) {
		return labelText(node.props.children);
	}
	return "";
}

/**
 * Radix 的前缀预测输入按 textValue 匹配。汉字标签换成拼音声母，
 * 这样输入 B 能跳到「编辑」、F 跳到「复制链接」；英文标签保持原样。
 */
function typeaheadValue(textValue: string | undefined, children: ReactNode): string | undefined {
	if (textValue !== undefined) return textValue;
	const label = labelText(children).trim();
	return label ? pinyinInitials(label) : undefined;
}

type ItemProps = ComponentProps<typeof DropdownMenuPrimitive.Item>;

export type MenuItemProps = ItemProps & {
	inset?: boolean;
	variant?: "default" | "destructive";
	/** 不可用时写在右侧的原因，与快捷键同一位置。 */
	reason?: ReactNode;
};

export type MenuCheckboxItemProps = ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem> & {
	/** 选中后是否收起菜单；多选项默认不收起，可以连着改。 */
	closeOnSelect?: boolean;
};

export type MenuLabelProps = ComponentProps<typeof DropdownMenuPrimitive.Label> & {
	inset?: boolean;
};

export type MenuSubTriggerProps = ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
	inset?: boolean;
};

export interface MenuGroupProps extends ComponentProps<typeof DropdownMenuPrimitive.Group> {}
export interface MenuRadioGroupProps
	extends ComponentProps<typeof DropdownMenuPrimitive.RadioGroup> {}
export interface MenuRadioItemProps
	extends ComponentProps<typeof DropdownMenuPrimitive.RadioItem> {}
export interface MenuSeparatorProps
	extends ComponentProps<typeof DropdownMenuPrimitive.Separator> {}
export interface MenuSubProps extends ComponentProps<typeof DropdownMenuPrimitive.Sub> {}
export interface MenuSubContentProps
	extends ComponentProps<typeof DropdownMenuPrimitive.SubContent> {}

/** 显式声明部件类型：推断类型会引用 Radix 的内部路径，生成声明时无法移植。 */
export interface MenuParts {
	Group: (props: MenuGroupProps) => ReactElement;
	Item: (props: MenuItemProps) => ReactElement;
	CheckboxItem: (props: MenuCheckboxItemProps) => ReactElement;
	RadioGroup: (props: MenuRadioGroupProps) => ReactElement;
	RadioItem: (props: MenuRadioItemProps) => ReactElement;
	Label: (props: MenuLabelProps) => ReactElement;
	Separator: (props: MenuSeparatorProps) => ReactElement;
	Shortcut: (props: ComponentProps<"kbd">) => ReactElement;
	Sub: (props: MenuSubProps) => ReactElement;
	SubTrigger: (props: MenuSubTriggerProps) => ReactElement;
	SubContent: (props: MenuSubContentProps) => ReactElement;
}

/** 创建一组菜单部件；两个单元用不同的 Radix 命名空间与 data-slot 前缀，视觉与行为同源。 */
export function createMenuParts(slot: MenuSlot, Primitive: MenuPrimitive): MenuParts {
	function Group({ className, ...props }: ComponentProps<typeof DropdownMenuPrimitive.Group>) {
		return (
			<Primitive.Group
				data-slot={`${slot}-group`}
				className={cn("v-dropdown-menu__group", className)}
				{...props}
			/>
		);
	}

	function Item({
		className,
		inset,
		variant = "default",
		reason,
		textValue,
		children,
		onPointerMove,
		...props
	}: MenuItemProps) {
		const handlePointerMove = useSubGrace(onPointerMove);
		return (
			<Primitive.Item
				data-slot={`${slot}-item`}
				data-inset={inset ? "" : undefined}
				data-variant={variant}
				className={cn("v-dropdown-menu__item", className)}
				textValue={typeaheadValue(textValue, children)}
				onPointerMove={handlePointerMove}
				{...props}
			>
				{/* 没有原因时只传 children 本身：asChild 要求单个子元素 */}
				{reason ? (
					<>
						{children}
						<span className="v-dropdown-menu__reason">{reason}</span>
					</>
				) : (
					children
				)}
			</Primitive.Item>
		);
	}

	function CheckboxItem({
		className,
		children,
		textValue,
		closeOnSelect = false,
		onSelect,
		onPointerMove,
		...props
	}: MenuCheckboxItemProps) {
		const handlePointerMove = useSubGrace(onPointerMove);
		return (
			<Primitive.CheckboxItem
				data-slot={`${slot}-checkbox-item`}
				className={cn("v-dropdown-menu__item", className)}
				textValue={typeaheadValue(textValue, children)}
				onPointerMove={handlePointerMove}
				onSelect={(event) => {
					if (!closeOnSelect) event.preventDefault();
					onSelect?.(event);
				}}
				{...props}
			>
				<span className="v-dropdown-menu__mark" aria-hidden="true">
					<span className="v-dropdown-menu__box">
						<Primitive.ItemIndicator forceMount className="v-dropdown-menu__check">
							<CheckIcon />
						</Primitive.ItemIndicator>
					</span>
				</span>
				{children}
			</Primitive.CheckboxItem>
		);
	}

	function RadioGroup({
		className,
		...props
	}: ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
		return (
			<Primitive.RadioGroup
				data-slot={`${slot}-radio-group`}
				className={cn("v-dropdown-menu__group", className)}
				{...props}
			/>
		);
	}

	function RadioItem({
		className,
		children,
		textValue,
		onPointerMove,
		...props
	}: ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
		const handlePointerMove = useSubGrace(onPointerMove);
		return (
			<Primitive.RadioItem
				data-slot={`${slot}-radio-item`}
				className={cn("v-dropdown-menu__item", className)}
				textValue={typeaheadValue(textValue, children)}
				onPointerMove={handlePointerMove}
				{...props}
			>
				<span className="v-dropdown-menu__mark" aria-hidden="true">
					<Primitive.ItemIndicator forceMount className="v-dropdown-menu__check">
						<CheckIcon />
					</Primitive.ItemIndicator>
				</span>
				{children}
			</Primitive.RadioItem>
		);
	}

	function Label({ className, inset, ...props }: MenuLabelProps) {
		return (
			<Primitive.Label
				data-slot={`${slot}-label`}
				data-inset={inset ? "" : undefined}
				className={cn("v-dropdown-menu__label", className)}
				{...props}
			/>
		);
	}

	function Separator({
		className,
		...props
	}: ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
		return (
			<Primitive.Separator
				data-slot={`${slot}-separator`}
				className={cn("v-dropdown-menu__separator", className)}
				{...props}
			/>
		);
	}

	function Shortcut({ className, ...props }: ComponentProps<"kbd">) {
		return (
			<kbd
				data-slot={`${slot}-shortcut`}
				className={cn("v-dropdown-menu__shortcut", className)}
				{...props}
			/>
		);
	}
	SHORTCUT_TYPES.add(Shortcut);

	function Sub({
		open: openProp,
		defaultOpen = false,
		onOpenChange,
		...props
	}: ComponentProps<typeof DropdownMenuPrimitive.Sub>) {
		const [open, setOpen] = useControllableState({
			prop: openProp,
			defaultProp: defaultOpen,
			onChange: onOpenChange,
		});
		const triggerRef = useRef<HTMLElement | null>(null);
		const openRef = useRef(open);
		openRef.current = open;
		const context = useMemo<SubState>(
			() => ({
				triggerRef,
				isOpen: () => openRef.current,
				close: () => {
					setOpen(false);
					triggerRef.current?.focus();
				},
			}),
			[setOpen],
		);
		return (
			<SubContext.Provider value={context}>
				<Primitive.Sub
					data-slot={`${slot}-sub`}
					open={open}
					onOpenChange={setOpen}
					{...props}
				/>
			</SubContext.Provider>
		);
	}

	function SubTrigger({
		className,
		inset,
		textValue,
		children,
		ref,
		onPointerMove,
		onPointerLeave,
		...props
	}: MenuSubTriggerProps) {
		const grace = useContext(GraceContext);
		const sub = useContext(SubContext);
		const composedRef = useComposedRefs(ref, sub?.triggerRef);
		const handlePointerMove = useSubGrace(
			composeEventHandlers(onPointerMove, () => resetGrace(grace)),
		);
		const handlePointerLeave = composeEventHandlers(
			onPointerLeave,
			(event: PointerEvent<HTMLDivElement>) => {
				if (!grace || event.pointerType !== "mouse") return;
				resetGrace(grace);
				grace.timer = setTimeout(() => {
					grace.expired = true;
				}, SUB_GRACE_MS);
			},
		);
		return (
			<Primitive.SubTrigger
				data-slot={`${slot}-sub-trigger`}
				data-inset={inset ? "" : undefined}
				className={cn("v-dropdown-menu__item v-dropdown-menu__sub-trigger", className)}
				textValue={typeaheadValue(textValue, children)}
				ref={composedRef}
				onPointerMove={handlePointerMove}
				onPointerLeave={handlePointerLeave}
				{...props}
			>
				{children}
				<ChevronRightIcon className="v-dropdown-menu__chevron" aria-hidden="true" />
			</Primitive.SubTrigger>
		);
	}

	function SubContent({
		className,
		sideOffset = SUB_SIDE_OFFSET,
		children,
		ref,
		onFocus,
		onPointerMove,
		onEscapeKeyDown,
		...props
	}: ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
		const parentGrace = useContext(GraceContext);
		const sub = useContext(SubContext);
		const surface = useMenuSurface({ ref, onFocus });
		return (
			<Primitive.SubContent
				data-slot={`${slot}-sub-content`}
				sideOffset={sideOffset}
				className={cn(
					"v-float v-dropdown-menu__content v-dropdown-menu__sub-content",
					slot === "context-menu" && "v-context-menu__sub-content",
					className,
				)}
				{...props}
				ref={surface.ref}
				onFocus={surface.onFocus}
				onPointerMove={composeEventHandlers(onPointerMove, () => resetGrace(parentGrace))}
				// Radix 的子菜单 Esc 会收起整个菜单；设计稿要求只收起子菜单，焦点回到触发项。
				// 子菜单已在退场时（连按两次 Esc）交还给 Radix，才能收起整个菜单
				onEscapeKeyDown={composeEventHandlers(onEscapeKeyDown, (event) => {
					if (!sub?.isOpen()) return;
					event.preventDefault();
					sub.close();
				})}
			>
				<MenuSurfaceBody surface={surface}>{children}</MenuSurfaceBody>
			</Primitive.SubContent>
		);
	}

	return {
		Group,
		Item,
		CheckboxItem,
		RadioGroup,
		RadioItem,
		Label,
		Separator,
		Shortcut,
		Sub,
		SubTrigger,
		SubContent,
	};
}
