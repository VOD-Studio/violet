import { formatRelativeTime } from "@shared/lib/date";
import { avatarUrl } from "@shared/lib/image-url";
import { Link } from "@tanstack/react-router";
import { Avatar, GithubIcon, GoogleIcon } from "@violet/ui";
import { cn } from "cn";
import type { CommentDisplayItem, CommentRaw } from "./types";

interface CommentPresentationProps<T extends CommentRaw> {
	item: CommentDisplayItem<T>;
}

/** SDK 负责尺寸与作者环；这里只保留站点头像 URL 与第三方身份角标。 */
export function CommentAvatar<T extends CommentRaw>({ item }: CommentPresentationProps<T>) {
	return (
		<div className="relative size-full">
			<Avatar
				src={item.authorAvatarUrl ? avatarUrl(item.authorAvatarUrl) : undefined}
				name={item.authorName}
				alt=""
			/>
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

export function CommentAuthor<T extends CommentRaw>({ item }: CommentPresentationProps<T>) {
	if (item.authorHref) {
		return (
			<Link to={item.authorHref} className="hover:underline">
				{item.authorName}
			</Link>
		);
	}
	return <span>{item.authorName}</span>;
}

interface ProviderBadgeProps {
	provider: "github" | "google";
	profileUrl?: string;
	authorName: string;
}

/**
 * GitHub 未回填 github_login 时只显图标不可跳；Google 无公开个人主页，恒纯展示。
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
					className={cn(
						shell,
						"transition-colors hover:ring-foreground/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
					)}
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

/** 解析失败或异常年份回退「刚刚」，避免向原生时间节点显示 Invalid Date。 */
export function formatCommentTime(createdAt: string): string {
	const date = new Date(createdAt);
	if (Number.isNaN(date.getTime()) || date.getFullYear() < 2000) {
		return "刚刚";
	}
	return formatRelativeTime(date);
}
