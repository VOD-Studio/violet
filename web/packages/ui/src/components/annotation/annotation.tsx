import { cn } from "cn";
import type { ComponentProps } from "react";
import { Button } from "../button";

/** 可激活的原文标记；名称由宿主提供，业务锚点和打开状态仍由宿主持有。 */
export interface AnnotationMarkProps extends ComponentProps<"mark"> {
	"aria-label": string;
}

/** 保留 mark 原生节点与 ref，并为按钮语义补齐 Enter / Space 激活。 */
export function AnnotationMark({
	className,
	onKeyDown,
	tabIndex = 0,
	...props
}: AnnotationMarkProps) {
	return (
		<mark
			{...props}
			// biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: 批注保留原生 mark，Enter 与 Space 激活由本组件实现。
			role="button"
			tabIndex={tabIndex}
			className={cn("v-annotation__mark", className)}
			onKeyDown={(event) => {
				onKeyDown?.(event);
				if (event.defaultPrevented || event.repeat || event.target !== event.currentTarget)
					return;
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					event.currentTarget.click();
				}
			}}
		/>
	);
}

/** 工具栏原生属性，定位与选区归宿主管理。 */
export type AnnotationToolbarProps = ComponentProps<"div">;

/** 选区操作栏；所有操作按钮按正常 Tab 顺序访问。 */
export function AnnotationToolbar({ className, children, ...props }: AnnotationToolbarProps) {
	return (
		<div
			role="toolbar"
			aria-label="批注工具"
			{...props}
			className={cn("v-annotation__toolbar", className)}
		>
			{children}
			<i aria-hidden="true" />
		</div>
	);
}

/** 选区操作按钮，复用 Button 的原生事件、禁用与 ref 契约。 */
export type AnnotationToolButtonProps = ComponentProps<"button">;

/** 工具栏内的单个操作；保留宿主取消事件和原生按钮行为。 */
export function AnnotationToolButton({ className, ...props }: AnnotationToolButtonProps) {
	return <Button variant="ghost" {...props} className={cn("v-annotation__tool", className)} />;
}

/** 批注纸片的原生属性；不隐式添加 dialog 或接管焦点。 */
export type AnnotationCardFrameProps = ComponentProps<"div">;

/** 宽 320px 的批注纸片，可作为 Popover.Content 的 asChild 子节点。 */
export function AnnotationCardFrame({ className, ...props }: AnnotationCardFrameProps) {
	return <div {...props} className={cn("v-annotation__card", className)} />;
}
