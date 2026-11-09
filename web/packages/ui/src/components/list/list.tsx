"use client";

import { cn } from "cn";
import { ChevronRight, type LucideProps } from "lucide-react";
import { Slot } from "radix-ui";
import {
	type AriaAttributes,
	type ComponentProps,
	type HTMLAttributes,
	isValidElement,
	type MouseEventHandler,
	type ReactElement,
	type ReactNode,
	type Ref,
} from "react";
import { ListHighlight, ListHighlightItem } from "../list-highlight";

export type ListDensity = "comfortable" | "compact";

/** 根节点是 ul，ref、className 与原生属性都落在它上面。 */
export interface ListProps extends ComponentProps<"ul"> {
	/** 舒适行高 56，紧凑行高 40。 @default "comfortable" */
	density?: ListDensity;
}

/** 成行的内容：设置项、成员、文件、导航；悬停是一块在行间滑动的底色。 */
export function List({ density = "comfortable", className, ref, ...props }: ListProps) {
	return (
		<ListHighlight>
			<ul {...props} ref={ref} data-density={density} className={cn("v-list", className)} />
		</ListHighlight>
	);
}

/** 纯展示行，或行里还有其他操作；行本身不可交互。 */
export interface StaticListItemProps extends Omit<ComponentProps<"div">, "onClick"> {
	asChild?: false;
	onClick?: undefined;
	/** disabled 与 type 只属于 button 行，类型层拒绝落到 div 上。 */
	disabled?: never;
	type?: never;
}

/** 整行可点：行是原生 button，type 默认为 button。 */
export interface ButtonListItemProps extends ComponentProps<"button"> {
	asChild?: false;
	onClick: MouseEventHandler<HTMLButtonElement>;
}

/** 整行是调用方的链接或其它元素：属性与 ref 合并到唯一子元素上。 */
export interface SlotListItemProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
	asChild: true;
	children: ReactElement;
	ref?: Ref<HTMLElement>;
}

/**
 * 行元素的形态由 `onClick` 与 `asChild` 决定；ref、className 与原生属性落在行元素上，不在外层 li 上。
 */
export type ListItemProps = StaticListItemProps | ButtonListItemProps | SlotListItemProps;

type RowProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
	asChild?: boolean;
	children?: ReactNode;
	ref?: Ref<HTMLElement>;
	type?: "button" | "submit" | "reset";
};

function isCurrent(value: AriaAttributes["aria-current"]) {
	return value !== undefined && value !== false && value !== "false";
}

/**
 * 一行。传 `onClick` 是 button，`asChild` 换成调用方的链接；都不传是普通容器，
 * 行内的 {@link ListItemAction} 是行里唯一的交互元素。
 */
export function ListItem(props: ListItemProps) {
	const { asChild, className, children, ref, ...rest } = props as RowProps;
	const classes = cn("v-list__row", className);
	const ariaCurrent =
		rest["aria-current"] ??
		(asChild && isValidElement<AriaAttributes>(children)
			? children.props["aria-current"]
			: undefined);

	let row: ReactElement;
	if (asChild) {
		row = (
			<Slot.Root {...rest} ref={ref} className={classes}>
				{children}
			</Slot.Root>
		);
	} else if (typeof rest.onClick === "function") {
		row = (
			<button
				{...rest}
				type={rest.type ?? "button"}
				ref={ref as Ref<HTMLButtonElement>}
				className={classes}
			>
				{children}
			</button>
		);
	} else {
		row = (
			<div {...rest} ref={ref as Ref<HTMLDivElement>} className={classes}>
				{children}
			</div>
		);
	}

	return (
		<li className="v-list__item">
			<ListHighlightItem active={isCurrent(ariaCurrent)}>{row}</ListHighlightItem>
		</li>
	);
}

/** 左侧 36 的图标块；头像直接放 Avatar，列表会把它收成同样大小。 */
export function ListItemIcon({ className, ...props }: ComponentProps<"span">) {
	return <span {...props} className={cn("v-list__icon", className)} />;
}

/** 标题与说明的纵向容器，占满行内剩余宽度。 */
export function ListItemContent({ className, ...props }: ComponentProps<"span">) {
	return <span {...props} className={cn("v-list__content", className)} />;
}

export interface ListItemTextProps extends ComponentProps<"span"> {
	/** 等宽字体，用于文件名、邮箱、大小。 */
	mono?: boolean;
}

/** 14 / 500，单行，超出省略；当前项 600。 */
export function ListItemTitle({ mono, className, ...props }: ListItemTextProps) {
	return (
		<span
			{...props}
			data-mono={mono ? "" : undefined}
			className={cn("v-list__title", className)}
		/>
	);
}

/** 13 次级色，单行，超出省略。 */
export function ListItemDescription({ mono, className, ...props }: ListItemTextProps) {
	return (
		<span
			{...props}
			data-mono={mono ? "" : undefined}
			className={cn("v-list__description", className)}
		/>
	);
}

/** 右侧的次级色数值或当前设置；`mono` 用等宽数字。 */
export function ListItemValue({ mono, className, ...props }: ListItemTextProps) {
	return (
		<span
			{...props}
			data-mono={mono ? "" : undefined}
			className={cn("v-list__value", className)}
		/>
	);
}

/** 右侧 16 的箭头，装饰用，整行是按钮或链接时表示「进入下一级」。 */
export function ListItemChevron({ className, ...props }: LucideProps) {
	return (
		<ChevronRight
			size={16}
			aria-hidden="true"
			{...props}
			className={cn("v-list__chevron", className)}
		/>
	);
}

/** 右侧 32 的幽灵圆钮，例如 ⋯、下载；必须由调用方给出写明是谁的 `aria-label`。 */
export function ListItemAction({ className, type = "button", ...props }: ComponentProps<"button">) {
	return <button {...props} type={type} className={cn("v-list__action", className)} />;
}
