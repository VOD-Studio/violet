"use client";

import { cn } from "cn";
import { ContextMenu as ContextMenuPrimitive } from "radix-ui";
import { composeEventHandlers, useComposedRefs } from "radix-ui/internal";
import {
	type ComponentProps,
	createContext,
	type MutableRefObject,
	type PointerEvent,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import { createMenuParts, MenuSurfaceBody } from "../../lib/menu-parts";
import { ListHighlight } from "../list-highlight";

const parts = createMenuParts("context-menu", ContextMenuPrimitive);

interface Point {
	x: number;
	y: number;
}

/** 最近一次按下或右键的位置：Radix 把它当作虚拟锚点，但不对外提供。 */
const PointerOriginContext = createContext<MutableRefObject<Point | null> | null>(null);

/**
 * 在区域上点右键或长按打开的一列命令；与操作菜单共用同一套项。
 *
 * @remarks
 * 被右键的元素在菜单打开期间带 `data-state="open"`（由 ContextMenuTrigger 标出），
 * 用 `data-[state=open]:` 一类选择器让那一行保持标记，菜单收起即还原。
 */
export function ContextMenu(props: ComponentProps<typeof ContextMenuPrimitive.Root>) {
	const origin = useRef<Point | null>(null);
	return (
		<PointerOriginContext.Provider value={origin}>
			<ContextMenuPrimitive.Root data-slot="context-menu" {...props} />
		</PointerOriginContext.Provider>
	);
}

/** 右键区域；`asChild` 时 `data-state` 落在子元素上，打开期间为 `open`。 */
export function ContextMenuTrigger({
	onContextMenu,
	onPointerDown,
	...props
}: ComponentProps<typeof ContextMenuPrimitive.Trigger>) {
	const origin = useContext(PointerOriginContext);
	const remember = (event: { clientX: number; clientY: number }) => {
		if (origin) origin.current = { x: event.clientX, y: event.clientY };
	};
	return (
		<ContextMenuPrimitive.Trigger
			data-slot="context-menu-trigger"
			onContextMenu={composeEventHandlers(onContextMenu, remember)}
			onPointerDown={composeEventHandlers(
				onPointerDown,
				(event: PointerEvent<HTMLSpanElement>) => remember(event),
			)}
			{...props}
		/>
	);
}

/** 自行控制挂载位置时使用；ContextMenuContent 已自带 Portal。 */
export function ContextMenuPortal(props: ComponentProps<typeof ContextMenuPrimitive.Portal>) {
	return <ContextMenuPrimitive.Portal data-slot="context-menu-portal" {...props} />;
}

/** 菜单面板属性：`container` 与 `onOpenAutoFocus` 之外均为 Radix Content 的属性。 */
export type ContextMenuContentProps = ComponentProps<typeof ContextMenuPrimitive.Content> & {
	/** Portal 的挂载容器，默认挂到 body。 */
	container?: ComponentProps<typeof ContextMenuPrimitive.Portal>["container"];
	/** 面板挂载后接管焦点前触发；`preventDefault` 可保持焦点不动。Radix 运行时支持但类型未公开。 */
	onOpenAutoFocus?: (event: Event) => void;
};

/**
 * 菜单面板：在指针处出现，靠近窗口右边或底边时往里翻；↑↓ 到头后循环。
 *
 * @remarks
 * 从指针那一角斜着浮出 4px；收起时原地淡出。
 * 键盘预测输入、宽度与层级与 DropdownMenuContent 相同。
 */
export function ContextMenuContent({
	className,
	collisionPadding = 8,
	loop = true,
	container,
	children,
	ref,
	onFocus,
	...props
}: ContextMenuContentProps) {
	const origin = useContext(PointerOriginContext);
	const [node, setNode] = useState<HTMLDivElement | null>(null);
	const composedRef = useComposedRefs(ref, setNode);

	// 垂直方向被推回窗口内时，菜单整体在指针上方：浮出方向要朝向指针，才是从指针那一角出来
	useEffect(() => {
		const wrapper = node?.parentElement;
		if (!node || !wrapper) return;
		const place = () => {
			const pointer = origin?.current;
			if (!pointer) return;
			const above = node.getBoundingClientRect().top < pointer.y - 8;
			node.style.setProperty("--v-context-from-y", above ? "4px" : "-4px");
		};
		place();
		// 内容在首次定位完成时才开始动画：定位会改写外层容器的 style，此时再读几何
		const observer = new MutationObserver(place);
		observer.observe(wrapper, { attributes: true, attributeFilter: ["style"] });
		return () => observer.disconnect();
	}, [node, origin]);

	return (
		<ContextMenuPrimitive.Portal container={container}>
			<ListHighlight mode="focus">
				<ContextMenuPrimitive.Content
					data-slot="context-menu-content"
					collisionPadding={collisionPadding}
					loop={loop}
					className={cn(
						"v-float v-dropdown-menu__content v-context-menu__content",
						className,
					)}
					{...props}
					ref={composedRef}
					onFocus={onFocus}
				>
					<MenuSurfaceBody>{children}</MenuSurfaceBody>
				</ContextMenuPrimitive.Content>
			</ListHighlight>
		</ContextMenuPrimitive.Portal>
	);
}

/** 把相邻的项归为一组，读屏按 group 朗读。 */
export const ContextMenuGroup = parts.Group;

/** 普通项：执行后收起菜单；`variant="destructive"`、`inset`、`reason` 与 DropdownMenuItem 相同。 */
export const ContextMenuItem = parts.Item;

/** 多选项：左侧方框，`aria-checked`；点了不收起，需要收起时传 `closeOnSelect`。 */
export const ContextMenuCheckboxItem = parts.CheckboxItem;

/** 单选组：当前值由 `value` 持有。 */
export const ContextMenuRadioGroup = parts.RadioGroup;

/** 单选项：左侧对勾表示当前值；选中后收起菜单。 */
export const ContextMenuRadioItem = parts.RadioItem;

/** 分组标题：12 浅色，不可点。 */
export const ContextMenuLabel = parts.Label;

/** 分隔线：1px，左右 8、上下 6。 */
export const ContextMenuSeparator = parts.Separator;

/** 项右侧的快捷键提示：12 浅色，一个组合是一个键帽；只作展示，不注册全局按键。 */
export const ContextMenuShortcut = parts.Shortcut;

/** 子菜单容器；只允许一层子菜单，更深的结构改用对话框或单独的页面。 */
export const ContextMenuSub = parts.Sub;

/** 子菜单触发项：悬停 100ms 或按 → 打开，指针离开后有 120ms 宽限。 */
export const ContextMenuSubTrigger = parts.SubTrigger;

/** 子菜单面板：← 或 Esc 只收起子菜单；选了其中的项整个菜单一起收起。 */
export const ContextMenuSubContent = parts.SubContent;
