import type { ComponentPropsWithRef, ReactNode } from "react";

/**
 * 无来源绑定的推文布局，按作者、正文、媒体、引用、操作的顺序组合内容。
 *
 * 原生 article 属性直接传给根节点；路由、交互和数据由调用方管理。
 */
export interface TweetCardProps
	extends Omit<ComponentPropsWithRef<"article">, "children" | "dangerouslySetInnerHTML"> {
	/** 作者信息与卡片级操作。 */
	headerSlot?: ReactNode;
	/** 正文或不可用状态。 */
	contentSlot?: ReactNode;
	/** 图片、视频等媒体内容。 */
	mediaSlot?: ReactNode;
	/** 被引用的内容，使用统一引用间距。 */
	quoteSlot?: ReactNode;
	/** 时间、提示与互动操作。 */
	footerSlot?: ReactNode;
	/**
	 * 使用紧凑间距。
	 * @default false
	 */
	compact?: boolean;
	/**
	 * 标记嵌套引用卡片，使用引用背景与边框。
	 * @default false
	 */
	isQuoted?: boolean;
}

/** 共享推文外观与内容顺序，不添加 X 品牌、来源链接或默认操作。 */
export function TweetCard({
	headerSlot,
	contentSlot,
	mediaSlot,
	quoteSlot,
	footerSlot,
	compact = false,
	isQuoted = false,
	className,
	...articleProps
}: TweetCardProps) {
	return (
		<article
			{...articleProps}
			className={`not-prose v-tweet${compact ? " v-tweet--compact" : ""}${isQuoted ? " v-tweet--quoted" : ""}${className ? ` ${className}` : ""}`}
		>
			{headerSlot}
			{contentSlot}
			{mediaSlot}
			{quoteSlot != null && quoteSlot !== false && (
				<div className="v-tweet__quote">{quoteSlot}</div>
			)}
			{footerSlot}
		</article>
	);
}
