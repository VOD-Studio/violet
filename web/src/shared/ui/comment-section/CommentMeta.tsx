/**
 * CommentMeta - 评论元信息（头像 + 昵称 + 「回复 @yyy」+ 作者徽章 + 审批中徽章 + 时间）
 *
 * 文章评论与推文评论共用：头像空时首字母兜底；authorHref 存在时昵称渲染为链接
 * （推文 /users/$username；文章匿名评论无主页）。
 */
import { avatarUrl } from "@shared/lib/image-url";
import PendingBadge from "@shared/ui/pending-badge";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { getCommentToneCfg } from "./tone";
import type { CommentDisplayItem, CommentRaw } from "./types";

export interface CommentMetaProps<T extends CommentRaw> {
	item: CommentDisplayItem<T>;
}

export function CommentMeta<T extends CommentRaw>({ item }: CommentMetaProps<T>) {
	const tone = getCommentToneCfg(item.tone ?? "default");
	return (
		<div className="flex flex-wrap items-center gap-2">
			{item.authorAvatarUrl ? (
				<img
					src={avatarUrl(item.authorAvatarUrl)}
					alt={item.authorName}
					className="size-6 shrink-0 rounded-full object-cover"
					loading="lazy"
				/>
			) : (
				<div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
					{item.authorName.slice(0, 1).toUpperCase()}
				</div>
			)}
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

export default CommentMeta;

/** 相对时间（容错：解析失败或异常年份回退「刚刚」） */
function formatTimeAgo(createdAt: string): string {
	const date = new Date(createdAt);
	if (Number.isNaN(date.getTime()) || date.getFullYear() < 2000) {
		return "刚刚";
	}
	return formatDistanceToNow(date, { addSuffix: true, locale: zhCN });
}
