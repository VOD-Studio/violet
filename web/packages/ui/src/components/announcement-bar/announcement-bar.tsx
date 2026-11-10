"use client";

import { cn } from "cn";
import { X } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

/** 公告语气；只换指示点颜色，文字与底色不跟着变。 */
export type AnnouncementBarSeverity = "info" | "warning" | "success" | "error";

/** 公告正文后的可选链接。 */
export interface AnnouncementBarLink {
	href: string;
	label: string;
}

export interface AnnouncementBarProps extends Omit<ComponentProps<"div">, "children" | "content"> {
	/** 一句话公告正文；放不下时尾部省略 */
	content: ReactNode;
	/** 可选链接；不传就只有正文 */
	link?: AnnouncementBarLink;
	/** 语气；默认 info */
	severity?: AnnouncementBarSeverity;
	/** 关闭；可见性与已读记录的保存由宿主负责 */
	onClose: () => void;
}

/**
 * 站点级公告浮条：一句话、可选链接与右侧关闭钮，宽度跟着内容走。
 *
 * @remarks
 * 自身不占页面高度，定位、多条轮换与已读记录留在宿主。
 */
export function AnnouncementBar({
	content,
	link,
	severity = "info",
	onClose,
	className,
	...props
}: AnnouncementBarProps) {
	return (
		<div className={cn("v-announcement-bar", className)} data-severity={severity} {...props}>
			<span className="v-announcement-bar__dot" aria-hidden="true" />
			<span className="v-announcement-bar__label">公告</span>
			<span className="v-announcement-bar__text">{content}</span>
			{link ? (
				<a className="v-announcement-bar__link" href={link.href}>
					{link.label}
				</a>
			) : null}
			<button
				type="button"
				className="v-announcement-bar__close"
				aria-label="关闭公告"
				onClick={onClose}
			>
				<X aria-hidden="true" />
			</button>
		</div>
	);
}