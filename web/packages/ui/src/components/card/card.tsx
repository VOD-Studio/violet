import { cn } from "cn";
import { Slot } from "radix-ui";
import type * as React from "react";

type DivProps = React.ComponentProps<"div">;

/** 基础卡：纸色底、软影、圆角 12；内边距在卡片上，分段自身不带水平留白。 */
function Card({ className, ...props }: DivProps) {
	return <div data-slot="card" className={cn("v-card", className)} {...props} />;
}

/** 头部：标题加一行说明，挂载 `CardAction` 时分两列。 */
function CardHeader({ className, ...props }: DivProps) {
	return <div data-slot="card-header" className={cn("v-card__header", className)} {...props} />;
}

function CardTitle({ className, ...props }: DivProps) {
	return <div data-slot="card-title" className={cn("v-card__title", className)} {...props} />;
}

function CardDescription({ className, ...props }: DivProps) {
	return (
		<div
			data-slot="card-description"
			className={cn("v-card__description", className)}
			{...props}
		/>
	);
}

function CardAction({ className, ...props }: DivProps) {
	return <div data-slot="card-action" className={cn("v-card__action", className)} {...props} />;
}

function CardContent({ className, ...props }: DivProps) {
	return <div data-slot="card-content" className={cn("v-card__content", className)} {...props} />;
}

/** 底部：操作靠右排列。 */
function CardFooter({ className, ...props }: DivProps) {
	return <div data-slot="card-footer" className={cn("v-card__footer", className)} {...props} />;
}

/**
 * 相框卡根：四周 8px 纸边包住图片，整张卡由 `CardFrameTitle` 的链接承载点击。
 * 卡内其他按钮自动浮在链接覆盖层之上，保持独立可点。
 */
function CardFrame({ className, ...props }: DivProps) {
	return <div data-slot="card-frame" className={cn("v-card-frame", className)} {...props} />;
}

/** 16:10 的图片容器，内部的 `img` 以 cover 填满。 */
function CardFrameImage({ className, ...props }: DivProps) {
	return (
		<div
			data-slot="card-frame-image"
			className={cn("v-card-frame__image", className)}
			{...props}
		/>
	);
}

function CardFrameBody({ className, ...props }: DivProps) {
	return (
		<div
			data-slot="card-frame-body"
			className={cn("v-card-frame__body", className)}
			{...props}
		/>
	);
}

/** 元信息：DOM 在标题之后（读屏先读标题），视觉上显示在标题上方。 */
function CardFrameMeta({ className, ...props }: DivProps) {
	return (
		<div
			data-slot="card-frame-meta"
			className={cn("v-card-frame__meta", className)}
			{...props}
		/>
	);
}

type CardFrameTitleBase = Omit<DivProps, "ref">;

/**
 * 相框卡标题的属性。原生模式渲染 div，ref 指向 div；`asChild` 把属性并入子元素
 * （通常是 `<a href>`），ref 指向子元素，其 `::after` 把点击区扩展到整张卡。
 */
type CardFrameTitleProps =
	| (CardFrameTitleBase & { asChild?: false; ref?: React.Ref<HTMLDivElement> })
	| (CardFrameTitleBase & { asChild: true; ref?: React.Ref<HTMLElement> });

function CardFrameTitle({ className, asChild = false, ref, ...props }: CardFrameTitleProps) {
	const Comp = asChild ? Slot.Root : "div";
	return (
		<Comp
			ref={ref as React.Ref<HTMLDivElement>}
			data-slot="card-frame-title"
			className={cn("v-card-frame__title", className)}
			{...props}
		/>
	);
}

/** 摘要：最多两行。 */
function CardFrameExcerpt({ className, ...props }: DivProps) {
	return (
		<div
			data-slot="card-frame-excerpt"
			className={cn("v-card-frame__excerpt", className)}
			{...props}
		/>
	);
}

export {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardFrame,
	CardFrameBody,
	CardFrameExcerpt,
	CardFrameImage,
	CardFrameMeta,
	CardFrameTitle,
	type CardFrameTitleProps,
	CardHeader,
	CardTitle,
};
