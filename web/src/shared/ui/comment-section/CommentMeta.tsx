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
import { Crown } from "lucide-react";
import { AUTHOR_TIER } from "./tone";
import type { CommentDisplayItem, CommentRaw } from "./types";

export interface CommentMetaProps<T extends CommentRaw> {
	item: CommentDisplayItem<T>;
}

const AVATAR_SIZE = { md: "size-9 text-sm", sm: "size-7 text-xs" } as const;

/** CommentAvatar 头像（空时首字母兜底）+ 右下角第三方登录角标 */
export function CommentAvatar<T extends CommentRaw>({
	item,
	size = "md",
}: CommentMetaProps<T> & { size?: keyof typeof AVATAR_SIZE }) {
	const avatar = item.authorAvatarUrl ? (
		<img
			src={avatarUrl(item.authorAvatarUrl)}
			alt={item.authorName}
			className={cn("shrink-0 rounded-full object-cover", AVATAR_SIZE[size])}
			loading="lazy"
		/>
	) : (
		<div
			className={cn(
				"flex shrink-0 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary",
				AVATAR_SIZE[size],
			)}
		>
			{item.authorName.slice(0, 1).toUpperCase()}
		</div>
	);
	return (
		<div className="relative shrink-0">
			{item.isAuthor ? (
				<div className={AUTHOR_TIER.avatarRing}>
					<div className="rounded-full bg-background p-px">{avatar}</div>
				</div>
			) : (
				avatar
			)}
			{item.isAuthor && (
				<span className={AUTHOR_TIER.crown} aria-hidden="true">
					<Crown className="size-2.5" fill="currentColor" />
				</span>
			)}
			{item.authorProvider && (
				<ProviderBadge
					provider={item.authorProvider}
					profileUrl={item.authorProfileUrl}
					authorName={item.authorName}
				/>
			)}
		</div>
	);
}

/** CommentMeta 评论标题行：昵称 +「回复 @yyy」+ 作者徽章 + 审批中徽章 + 时间 */
export function CommentMeta<T extends CommentRaw>({ item }: CommentMetaProps<T>) {
	const nameClass = item.isAuthor ? AUTHOR_TIER.name : "font-medium text-foreground";
	return (
		<div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
			{item.authorHref ? (
				<Link
					to={item.authorHref}
					className={cn("truncate text-sm hover:underline", nameClass)}
				>
					{item.authorName}
				</Link>
			) : (
				<span className={cn("truncate text-sm", nameClass)}>{item.authorName}</span>
			)}
			{item.replyToName && (
				<span className="text-xs text-muted-foreground">
					回复 <span className="text-primary">@{item.replyToName}</span>
				</span>
			)}
			{item.isAuthor && (
				<span className={AUTHOR_TIER.badge}>
					<Crown className="size-2.5" fill="currentColor" />
					作者
				</span>
			)}
			<PendingBadge show={!!item.isPending} />
			<time className="shrink-0 text-xs text-muted-foreground" title={item.createdAt}>
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
		"bg-background text-foreground ring-2 ring-background",
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
