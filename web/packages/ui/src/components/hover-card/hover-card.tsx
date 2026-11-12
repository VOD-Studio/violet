import { cn } from "cn";
import { HoverCard as HoverCardPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

/** HoverCard 根的属性：`openDelay` 默认 500ms、`closeDelay` 默认 200ms。 */
export type HoverCardProps = ComponentProps<typeof HoverCardPrimitive.Root>;

/**
 * 悬停预览卡：指针停留 500ms 后出现，离开 200ms 后消失；键盘聚焦同样延迟出现，Esc 立刻消失。
 * 触屏没有悬停，不会出现。只做预览，卡片里不放按钮。
 */
function HoverCard({ openDelay = 500, closeDelay = 200, ...props }: HoverCardProps) {
	return (
		<HoverCardPrimitive.Root
			data-slot="hover-card"
			openDelay={openDelay}
			closeDelay={closeDelay}
			{...props}
		/>
	);
}

/** 触发元素，通常是一个链接。 */
function HoverCardTrigger(props: ComponentProps<typeof HoverCardPrimitive.Trigger>) {
	return <HoverCardPrimitive.Trigger data-slot="hover-card-trigger" {...props} />;
}

/** 卡片属性：`container` 控制 Portal 挂载点，其余为 Radix HoverCard.Content 的属性。 */
interface HoverCardContentProps extends ComponentProps<typeof HoverCardPrimitive.Content> {
	/** 挂载 Portal 的容器；默认 `document.body`。 */
	container?: HTMLElement | null;
}

/** 卡片面板：无箭头，与触发器间隔 8px；这段空隙算在悬停范围内。 */
function HoverCardContent({
	className,
	align = "start",
	sideOffset = 8,
	collisionPadding = 8,
	container,
	...props
}: HoverCardContentProps) {
	return (
		<HoverCardPrimitive.Portal container={container}>
			<HoverCardPrimitive.Content
				data-slot="hover-card-content"
				align={align}
				sideOffset={sideOffset}
				collisionPadding={collisionPadding}
				{...props}
				className={cn("v-hover-card v-float", className)}
			/>
		</HoverCardPrimitive.Portal>
	);
}

export { HoverCard, HoverCardContent, type HoverCardContentProps, HoverCardTrigger };
