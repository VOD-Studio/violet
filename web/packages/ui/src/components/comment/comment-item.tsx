"use client";

import { cn } from "cn";
import { Crown, MessageCircle } from "lucide-react";
import { type CSSProperties, useId } from "react";
import { Button } from "../button";
import { iconProps } from "../icons";
import type { CommentItemProps } from "./types";
import { useReplyFocus } from "./use-reply-focus";

/** 以 article 展示一条评论；正文、回应与回复会话由宿主持有。 */
export function CommentItem({
	author,
	avatar,
	dateTime,
	time,
	replyTo,
	badges,
	isAuthor = false,
	reply = false,
	status = "visible",
	actions,
	onReply,
	replyForm,
	replies,
	enterDelay = 0,
	className,
	style,
	children,
	...props
}: CommentItemProps) {
	const formId = useId();
	const deleted = status === "deleted";
	const formOpen = !deleted && replyForm != null && replyForm !== false;
	const { formRef, replyButtonRef } = useReplyFocus(formOpen);
	const itemStyle = {
		"--v-comment-enter-delay": `${Math.max(0, enterDelay)}ms`,
		...style,
	} as CSSProperties;
	const hasActions = !deleted && (actions != null || onReply !== undefined);

	return (
		<article
			{...props}
			data-slot="comment-item"
			data-status={status}
			data-author={isAuthor || undefined}
			data-reply={reply || undefined}
			className={cn("v-comment", className)}
			style={itemStyle}
		>
			<div className="v-comment__avatar">
				<div className="v-comment__avatar-content">{avatar}</div>
				{isAuthor && (
					<span className="v-comment__crown" aria-hidden="true">
						<Crown {...iconProps(12)} />
					</span>
				)}
			</div>
			<div className="v-comment__main">
				<header className="v-comment__meta">
					<span className="v-comment__author">{author}</span>
					{isAuthor && <span className="v-comment__author-tag">作者</span>}
					{badges}
					{replyTo && <span className="v-comment__reply-to">回复 @{replyTo}</span>}
					<time className="v-comment__time" dateTime={dateTime}>
						{time}
					</time>
					{status === "pending" && (
						<span className="v-comment__pending">待审核 · 仅自己可见</span>
					)}
				</header>
				<div className="v-comment__bubble">{deleted ? "这条评论已删除" : children}</div>
				{hasActions && (
					<div className="v-comment__actions">
						{actions}
						{onReply && (
							<Button
								variant="ghost"
								className="v-comment__action"
								ref={replyButtonRef}
								aria-expanded={formOpen}
								aria-controls={formOpen ? formId : undefined}
								onClick={onReply}
								leftIcon={<MessageCircle aria-hidden="true" />}
							>
								回复
							</Button>
						)}
					</div>
				)}
				{formOpen && (
					<div className="v-comment__reply-form" ref={formRef} id={formId}>
						{replyForm}
					</div>
				)}
				{replies}
			</div>
		</article>
	);
}
