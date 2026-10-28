import type { ExternalTweet, TweetImageRef } from "@entities/tweet/model/types";
import { ExternalTweetCard } from "@entities/tweet/ui/ExternalTweetCard";
import { formatDateTime, formatRelativeTime } from "@shared/lib/date";
import { avatarUrl, contentImageUrl } from "@shared/lib/image-url";
import { cn } from "cn";

/** 缩略图最多展示的张数，其余折叠为最后一格上的「+N」。 */
const MAX_THUMBS = 4;

/** 方形小拼图：1 张整格、2 张并排、3 张一大两小、4 张四宫格。 */
function Thumbs({ urls, className }: { urls: string[]; className?: string }) {
	if (urls.length === 0) return null;
	const visible = urls.slice(0, MAX_THUMBS);
	const hidden = urls.length - visible.length;
	return (
		<div
			data-count={visible.length}
			className={cn(
				"grid size-20 shrink-0 gap-0.5 overflow-hidden rounded-lg bg-muted",
				visible.length === 1 ? "grid-cols-1 grid-rows-1" : "grid-cols-2 grid-rows-2",
				visible.length === 2 && "grid-rows-1",
				className,
			)}
		>
			{visible.map((url, index) => (
				<div
					key={`${url}:${index}`}
					className={cn(
						"relative min-h-0 min-w-0",
						visible.length === 3 && index === 0 && "row-span-2",
					)}
				>
					<img
						src={contentImageUrl(url, { width: 200 })}
						alt=""
						loading="lazy"
						className="absolute inset-0 size-full object-cover"
					/>
					{hidden > 0 && index === visible.length - 1 && (
						<span className="absolute inset-0 grid place-items-center bg-black/50 text-sm font-semibold text-white">
							+{hidden}
						</span>
					)}
				</div>
			))}
		</div>
	);
}

/** 摘要需要的字段；聊天分享推文与站内推文读模型都满足。 */
export interface SharedTweetSummaryData {
	author: { username: string; avatar_url: string };
	content?: string;
	images?: TweetImageRef[];
	created_at?: string;
	external_tweet?: ExternalTweet | null;
	quoted_tweet?: {
		author: { username: string };
		content?: string;
		images?: TweetImageRef[];
		external_tweet?: ExternalTweet | null;
	} | null;
}

export interface SharedTweetSummaryProps {
	/** 未删除、带作者的分享推文。 */
	tweet: SharedTweetSummaryData;
	/** 作者头像和名字的跳转由调用方处理（聊天里是链接，预览里是纯文本）。 */
	renderAuthor?: (author: SharedTweetSummaryData["author"]) => React.ReactNode;
	className?: string;
}

/**
 * 分享推文的摘要：作者一行，正文最多 3 行，本站图片为右侧方形小拼图，
 * X 原文与被引用的推文都是引用小卡片，不嵌入整条推文。
 */
export function SharedTweetSummary({ tweet, renderAuthor, className }: SharedTweetSummaryProps) {
	const { author } = tweet;
	const imageUrls = (tweet.images ?? []).map((img) => img.url);
	const quote = tweet.quoted_tweet;
	return (
		<div className={cn("flex flex-col gap-2", className)}>
			<div className="flex items-center gap-2">
				{renderAuthor ? (
					renderAuthor(author)
				) : (
					<>
						<img
							alt=""
							className="size-6 shrink-0 rounded-full object-cover"
							loading="lazy"
							src={avatarUrl(author.avatar_url, author.username)}
						/>
						<span className="truncate text-sm font-semibold text-foreground">
							{author.username}
						</span>
					</>
				)}
				{tweet.created_at && (
					<time
						className="shrink-0 text-xs text-muted-foreground"
						title={formatDateTime(tweet.created_at, "long")}
					>
						{formatRelativeTime(new Date(tweet.created_at))}
					</time>
				)}
			</div>
		{(tweet.content || imageUrls.length > 0) && (
				<div className="flex items-start gap-3">
					{tweet.content ? (
						<p className="line-clamp-3 min-w-0 flex-1 whitespace-pre-wrap wrap-break-word text-sm leading-relaxed text-foreground/90">
							{tweet.content}
						</p>
					) : (
						<span className="flex-1" />
					)}
				<Thumbs urls={imageUrls} />
				</div>
			)}
			{tweet.external_tweet && <ExternalTweetCard tweet={tweet.external_tweet} quoted />}
			{quote && (
				<div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-2.5">
					<div className="min-w-0 flex-1">
						<p className="truncate text-xs text-muted-foreground">
							引用 @{quote.author.username}
						</p>
						{quote.content && (
							<p className="mt-0.5 line-clamp-2 whitespace-pre-wrap wrap-break-word text-xs text-foreground/90">
								{quote.content}
							</p>
						)}
					</div>
				<Thumbs urls={(quote.images ?? []).map((img) => img.url)} className="size-14" />
				</div>
			)}
			{quote?.external_tweet && <ExternalTweetCard tweet={quote.external_tweet} quoted />}
		</div>
	);
}
