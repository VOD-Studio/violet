import { cn } from "cn";
import { Info } from "lucide-react";
import type { ComponentProps, ReactElement, ReactNode } from "react";

/** 整卡链接要展开的属性；自定义链接元素必须原样展开，覆盖层依赖 `className`。 */
export interface QuoteCardLinkProps {
	className: string;
	href: string;
	"aria-label"?: string;
	children: ReactNode;
}

/**
 * 被引用内容的摘要卡：作者、时间、两行正文与一张缩略图，整卡只有一处链接。
 * 删除态只留一行说明，不显示作者与时间。
 */
export interface QuoteCardProps extends Omit<ComponentProps<"div">, "children" | "title"> {
	/**
	 * 被引用内容的地址。正文链接的伪元素把点击区扩到整张卡；
	 * 省略时只展示内容，不生成链接（发布器预览这类不应离开当前页的语境）。
	 */
	href?: string;
	/** 链接的可访问名称；正文为空时必填，否则链接没有可读的文字。 */
	label?: string;
	/** 作者名；删除态不渲染。 */
	authorName?: string;
	/** 作者头像；装饰图，名字已经由 `authorName` 朗读。 */
	authorAvatar?: string;
	/** 已格式化的相对时间，例如「2 小时前」。 */
	time?: string;
	/** 时间的完整文案，作为 `<time>` 的 title。 */
	timeTitle?: string;
	/** 正文，最多两行。 */
	content?: string;
	/** 正文右侧的单张缩略图。 */
	imageSrc?: string;
	/** 被引用内容自身还引用了别的推文时的一行提示，不再嵌套第二张卡。 */
	nested?: string;
	/** 原文已删除：不可点，也不渲染作者与时间。 */
	deleted?: boolean;
	/**
	 * 删除态说明。
	 * @default "原推文已删除"
	 */
	deletedLabel?: string;
	/** 右上角的附加操作（如取消引用）；自动浮在覆盖层之上，保持独立可点。 */
	action?: ReactNode;
	/** 站内路由用它替换原生 `<a>`，保留客户端导航。 */
	renderLink?: (props: QuoteCardLinkProps) => ReactElement;
}

/** 删除态文案；调用方需要别的说法时传 `deletedLabel`。 */
const DEFAULT_DELETED_LABEL = "原推文已删除";

function QuoteCardBody({
	content,
	nested,
	imageSrc,
}: Pick<QuoteCardProps, "content" | "nested" | "imageSrc">) {
	return (
		<>
			<span className="v-quote-card__column">
				{content && <span className="v-quote-card__text">{content}</span>}
				{nested && <span className="v-quote-card__nested">{nested}</span>}
			</span>
			{imageSrc && (
				<img
					className="v-quote-card__image"
					src={imageSrc}
					alt=""
					width={64}
					height={64}
					loading="lazy"
					decoding="async"
				/>
			)}
		</>
	);
}

export function QuoteCard({
	href,
	label,
	authorName,
	authorAvatar,
	time,
	timeTitle,
	content,
	imageSrc,
	nested,
	deleted = false,
	deletedLabel = DEFAULT_DELETED_LABEL,
	action,
	renderLink,
	className,
	...props
}: QuoteCardProps) {
	if (deleted) {
		return (
			<div
				{...props}
				data-slot="quote-card"
				data-state="deleted"
				className={cn("v-quote-card", "v-quote-card--deleted", className)}
			>
				<p className="v-quote-card__deleted">
					<Info aria-hidden="true" className="v-quote-card__icon" />
					<span>{deletedLabel}</span>
				</p>
			</div>
		);
	}

	const body = <QuoteCardBody content={content} nested={nested} imageSrc={imageSrc} />;

	return (
		<div {...props} data-slot="quote-card" className={cn("v-quote-card", className)}>
			<div className="v-quote-card__header">
				<span className="v-quote-card__author">
					{authorAvatar && (
						<img
							className="v-quote-card__avatar"
							src={authorAvatar}
							alt=""
							width={20}
							height={20}
							loading="lazy"
							decoding="async"
						/>
					)}
					{authorName && <span className="v-quote-card__name">{authorName}</span>}
				</span>
				{time && (
					<time className="v-quote-card__time" title={timeTitle}>
						{time}
					</time>
				)}
				{action && <span className="v-quote-card__action">{action}</span>}
			</div>
			{href ? (
				renderLink ? (
					renderLink({
						className: "v-quote-card__link",
						href,
						"aria-label": label,
						children: body,
					})
				) : (
					<a className="v-quote-card__link" href={href} aria-label={label}>
						{body}
					</a>
				)
			) : (
				<div className="v-quote-card__body">{body}</div>
			)}
		</div>
	);
}
