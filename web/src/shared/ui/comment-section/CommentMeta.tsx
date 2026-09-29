/**
 * CommentMeta - 评论元信息（头像 + 昵称 + 「回复 @yyy」+ 作者徽章 + 审批中徽章 + 时间）
 *
 * 文章评论与推文评论共用：头像空时首字母兜底；authorHref 存在时昵称渲染为链接
 * （推文 /users/$username；文章匿名评论无主页）。头像右下角带第三方登录角标
 * （GitHub 可跳转主页，Google 纯展示）。
 */

import { formatRelativeTime } from "@shared/lib/date";
import { avatarUrl } from "@shared/lib/image-url";
import PendingBadge from "@shared/ui/pending-badge";
import { Link } from "@tanstack/react-router";
import { GithubIcon, GoogleIcon } from "@violet/ui";
import { cn } from "cn";
import { getCommentToneCfg } from "./tone";
import type { CommentDisplayItem, CommentRaw } from "./types";

export interface CommentMetaProps<T extends CommentRaw> {
	item: CommentDisplayItem<T>;
}

export function CommentMeta<T extends CommentRaw>({ item }: CommentMetaProps<T>) {
	const tone = getCommentToneCfg(item.tone ?? "default");
	return (
		<div className="flex flex-wrap items-center gap-2">
			<div className="relative shrink-0">
				{item.authorAvatarUrl ? (
					<img
						src={avatarUrl(item.authorAvatarUrl)}
						alt={item.authorName}
						className="size-7 shrink-0 rounded-full object-cover"
						loading="lazy"
					/>
				) : (
					<div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
						{item.authorName.slice(0, 1).toUpperCase()}
					</div>
				)}
				{item.authorProvider && (
					<ProviderBadge
						provider={item.authorProvider}
						profileUrl={item.authorProfileUrl}
						authorName={item.authorName}
					/>
				)}
			</div>
			{item.authorHref ? (
				<Link
					to={item.authorHref}
					className="truncate text-sm font-medium text-foreground hover:underline"
				>
					{item.authorName}
				</Link>
			) : (
				<span className="truncate text-sm font-medium text-foreground">
					{item.authorName}
				</span>
			)}
			{item.replyToName && (
				<span className="text-xs text-muted-foreground">
					回复 <span className="text-primary">@{item.replyToName}</span>
				</span>
			)}
			{item.isAuthor && (
				<span className={`rounded px-1.5 py-0.5 text-[10px] ${tone.badge}`}>作者</span>
			)}
			<PendingBadge show={!!item.isPending} />
			<time
				className="ml-auto shrink-0 font-mono text-xs tabular-nums text-muted-foreground"
				title={item.createdAt}
			>
				{formatTimeAgo(item.createdAt)}
			</time>
		</div>
	);
}

interface ProviderBadgeProps {
	provider: "github" | "google";
	profileUrl?: string;
	authorName: string;
}

/**
 * 头像右下角第三方登录角标：GitHub 图标在主页 URL 存在时渲染为外链（存量账号
 * 未回填 github_login 时只显图标不可跳），Google 无公开个人主页恒纯展示。
 */
function ProviderBadge({ provider, profileUrl, authorName }: ProviderBadgeProps) {
	const shell = cn(
		"absolute -right-1 -bottom-1 flex size-3.5 items-center justify-center rounded-full",
		"bg-background text-foreground ring-1 ring-border",
	);
	if (provider === "github") {
		const icon = <GithubIcon className="size-2.5" />;
		if (profileUrl) {
			return (
				<a
					href={profileUrl}
					target="_blank"
					rel="noopener noreferrer"
					aria-label={`${authorName} 的 GitHub 主页`}
					title="GitHub 主页"
					className={cn(shell, "transition-colors hover:ring-foreground/60")}
				>
					{icon}
				</a>
			);
		}
		return (
			<span className={shell} aria-hidden="true">
				{icon}
			</span>
		);
	}
	return (
		<span className={shell} aria-hidden="true">
			<GoogleIcon className="size-2.5" />
		</span>
	);
}

export default CommentMeta;

/** 相对时间（容错：解析失败或异常年份回退「刚刚」） */
function formatTimeAgo(createdAt: string): string {
	const date = new Date(createdAt);
	if (Number.isNaN(date.getTime()) || date.getFullYear() < 2000) {
		return "刚刚";
	}
	return formatRelativeTime(date);
}
