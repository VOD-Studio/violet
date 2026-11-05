"use client";

import { cn } from "cn";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import { composeEventHandlers, useComposedRefs } from "radix-ui/internal";
import { type ComponentProps, createContext, type RefObject, useContext, useRef } from "react";
import { createMenuParts, MenuSurfaceBody } from "../../lib/menu-parts";
import { ListHighlight } from "../list-highlight";

const parts = createMenuParts("dropdown-menu", DropdownMenuPrimitive);

/** 触发器元素：关闭后焦点回退用。 */
const TriggerRefContext = createContext<RefObject<HTMLButtonElement | null> | null>(null);

/**
 * 点按钮打开的一列命令：普通项、单选项、多选项、分组标题、分隔线、子菜单共用同一套项。
 * 键盘、读屏与受控行为都是 Radix DropdownMenu 的原生行为，菜单只放命令。
 */
export function DropdownMenu(props: ComponentProps<typeof DropdownMenuPrimitive.Root>) {
	const triggerRef = useRef<HTMLButtonElement | null>(null);
	return (
		<TriggerRefContext.Provider value={triggerRef}>
			<DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />
		</TriggerRefContext.Provider>
	);
}

/** 触发器；键盘按 ↓ / Enter / 空格打开并聚焦第一项，指针打开时不预先高亮。 */
export function DropdownMenuTrigger({
	ref,
	...props
}: ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
	const triggerRef = useContext(TriggerRefContext);
	const composedRef = useComposedRefs(ref, triggerRef);
	return (
		<DropdownMenuPrimitive.Trigger
			data-slot="dropdown-menu-trigger"
			ref={composedRef}
			{...props}
		/>
	);
}

/** 自行控制挂载位置时使用；DropdownMenuContent 已自带 Portal。 */
export function DropdownMenuPortal(props: ComponentProps<typeof DropdownMenuPrimitive.Portal>) {
	return <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />;
}

/** 菜单面板属性：`container` 与 `onOpenAutoFocus` 之外均为 Radix Content 的属性。 */
export type DropdownMenuContentProps = ComponentProps<typeof DropdownMenuPrimitive.Content> & {
	/** Portal 的挂载容器，默认挂到 body。 */
	container?: ComponentProps<typeof DropdownMenuPrimitive.Portal>["container"];
	/** 面板挂载后接管焦点前触发；`preventDefault` 可保持焦点不动。Radix 运行时支持但类型未公开。 */
	onOpenAutoFocus?: (event: Event) => void;
};

/**
 * 菜单面板：从触发器一侧浮出，与触发器间距 6，宽 200–280；↑↓ 到头后循环。
 *
 * @remarks
 * 面板内按字母键跳到下一个前缀相同的项，汉字标签按拼音首字母匹配；
 * 项的文字由字符串子节点自动推导，复杂结构的项请传 `textValue`。
 */
export function DropdownMenuContent({
	className,
	sideOffset = 6,
	collisionPadding = 8,
	loop = true,
	container,
	children,
	ref,
	onFocus,
	onCloseAutoFocus,
	...props
}: DropdownMenuContentProps) {
	const triggerRef = useContext(TriggerRefContext);
	return (
		<DropdownMenuPrimitive.Portal container={container}>
			<ListHighlight mode="focus">
				<DropdownMenuPrimitive.Content
					data-slot="dropdown-menu-content"
					sideOffset={sideOffset}
					collisionPadding={collisionPadding}
					loop={loop}
					className={cn("v-float v-dropdown-menu__content", className)}
					{...props}
					ref={ref}
					onFocus={onFocus}
					// Radix 点外面关闭时不还焦点；没有别的元素接走焦点时，设计稿要求回到触发器
					onCloseAutoFocus={composeEventHandlers(onCloseAutoFocus, (event) => {
						const active = document.activeElement;
						if (active && active !== document.body) return;
						event.preventDefault();
						triggerRef?.current?.focus();
					})}
				>
					<MenuSurfaceBody>{children}</MenuSurfaceBody>
				</DropdownMenuPrimitive.Content>
			</ListHighlight>
		</DropdownMenuPrimitive.Portal>
	);
}

/** 把相邻的项归为一组，读屏按 group 朗读。 */
export const DropdownMenuGroup = parts.Group;

/**
 * 普通项：执行后收起菜单。
 *
 * - `variant="destructive"`：危险项，文字与图标用危险色，放在最后并用分隔线隔开。
 * - `inset`：没有图标或标记的项留出左侧 16 宽的标记列，与同组带标记的项文字对齐。
 * - `reason`：不可用项右侧的一句原因，与快捷键同一位置；配合 `disabled` 使用。
 * - 不可用项变淡、悬停不高亮、键盘跳过，读屏读出 `aria-disabled`。
 */
export const DropdownMenuItem = parts.Item;

/**
 * 多选项：左侧方框，`aria-checked`；点了不收起，可以连着改。
 * 需要点后收起时传 `closeOnSelect`。
 */
export const DropdownMenuCheckboxItem = parts.CheckboxItem;

/** 单选组：当前值由 `value` 持有。 */
export const DropdownMenuRadioGroup = parts.RadioGroup;

/** 单选项：左侧对勾表示当前值；选中后收起菜单。 */
export const DropdownMenuRadioItem = parts.RadioItem;

/** 分组标题：12 浅色，不可点。 */
export const DropdownMenuLabel = parts.Label;

/** 分隔线：1px，左右 8、上下 6。 */
export const DropdownMenuSeparator = parts.Separator;

/** 项右侧的快捷键提示：12 浅色，一个组合是一个键帽；只作展示，不注册全局按键。 */
export const DropdownMenuShortcut = parts.Shortcut;

/**
 * 子菜单容器。只允许一层子菜单：子菜单内不要再放 DropdownMenuSub，
 * 更深的结构改用对话框或单独的页面。
 */
export const DropdownMenuSub = parts.Sub;

/**
 * 子菜单触发项，右侧带箭头：悬停 100ms 或按 → 打开；
 * 指针离开后有 120ms 宽限，往子菜单方向移动时不收起。
 */
export const DropdownMenuSubTrigger = parts.SubTrigger;

/**
 * 子菜单面板：与触发项顶部对齐，水平间距 4；右侧放不下时开在左边。
 * ← 或 Esc 只收起子菜单，焦点回到触发项；选了其中的项整个菜单一起收起。
 */
export const DropdownMenuSubContent = parts.SubContent;
