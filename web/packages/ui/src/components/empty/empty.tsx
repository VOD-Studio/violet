import { cn } from "cn";
import { Inbox } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

/** 空状态的形态：带插画的整块、无插画的筛选结果、面板里的一行。 */
export type EmptyVariant = "default" | "plain" | "compact";

export interface EmptyProps extends Omit<ComponentProps<"div">, "title"> {
	/** 一句话说清发生了什么，如「还没有想法」 */
	title: ReactNode;
	/** 第二句说现在能做什么，或当前的筛选条件 */
	description?: ReactNode;
	/** 当季小幅插画，由宿主提供；只在 default 形态渲染 */
	illustration?: ReactNode;
	/** 一个出口，如「记一条」「清除筛选」 */
	action?: ReactNode;
	/** 紧凑形态的图标；默认收件箱 */
	icon?: ReactNode;
	/** 形态；默认 default */
	variant?: EmptyVariant;
}

/**
 * 空状态：一句话说明发生了什么，第二句说明现在能做什么。
 *
 * @remarks
 * 标题与说明是普通文字，不加乱码或打字动画；插画只作为装饰，`role="status"` 让读屏在
 * 内容出现时朗读一次。筛选无结果时不放插画，直接写清筛选条件。
 */
export function Empty({
	title,
	description,
	illustration,
	action,
	icon,
	variant = "default",
	className,
	...props
}: EmptyProps) {
	return (
		<div
			data-slot="empty"
			data-variant={variant}
			role="status"
			className={cn("v-empty", className)}
			{...props}
		>
			{variant === "default" && illustration !== undefined ? (
				<span className="v-empty__illustration" aria-hidden="true">
					{illustration}
				</span>
			) : null}
			{variant === "compact" ? (
				<span className="v-empty__icon" aria-hidden="true">
					{icon ?? <Inbox />}
				</span>
			) : null}
			<p className="v-empty__title">{title}</p>
			{description !== undefined ? (
				<p className="v-empty__description">{description}</p>
			) : null}
			{action !== undefined && variant !== "compact" ? (
				<div className="v-empty__action">{action}</div>
			) : null}
		</div>
	);
}
