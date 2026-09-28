import { ExternalTweetCard } from "@entities/tweet/ui/ExternalTweetCard";
import { formatDateTime, formatRelativeTime } from "@shared/lib/date";
import { avatarUrl, contentImageUrl } from "@shared/lib/image-url";
import { ImageGrid, type ImageGridImage } from "@shared/ui/image-grid";
import { Link, useNavigate } from "@tanstack/react-router";
import { AlertCircle, MessageSquareQuote } from "lucide-react";
import type { SharedTweet } from "../model/types";

/** 聊天接口按本站推文 ID 读取的当前内容，删除时不展示历史原文。 */
export interface TweetShareCardProps {
	tweet: SharedTweet;
}

export function TweetShareCard({ tweet }: TweetShareCardProps) {
	const navigate = useNavigate();

	if (tweet.is_deleted || !tweet.author) {
		return (
			<div className="flex items-center gap-2 rounded-xl border border-dashed border-edge-hairline bg-muted/20 px-3 py-2.5 text-left text-xs text-muted-foreground">
				<AlertCircle className="size-4 shrink-0" />
				<span>该推文已被删除</span>
			</div>
		);
	}

	const author = tweet.author;
	const images: ImageGridImage[] = (tweet.images ?? []).map((url) => ({
		url,
		thumbnail: contentImageUrl(url, { width: 400 }),
	}));
	const openDetail = () => navigate({ to: "/tweets/$id", params: { id: tweet.id } });

	return (
		<div
			aria-label="查看推文"
			className="w-72 max-w-full cursor-pointer overflow-hidden rounded-xl border border-neon-cyan/30 bg-card/80 text-left backdrop-blur-md transition-colors hover:border-neon-cyan/60 hover:bg-card/95"
			onClick={openDetail}
			onKeyDown={(e) => {
				if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
					e.preventDefault();
					openDetail();
				}
			}}
			role="button"
			tabIndex={0}
		>
			<div className="flex items-center gap-2 border-b border-edge-hairline/60 bg-neon-cyan/5 px-3 py-2">
				<MessageSquareQuote className="size-3.5 shrink-0 text-neon-cyan" />
				<span className="font-mono text-[10px] uppercase tracking-[0.08em] text-neon-cyan">
					分享的推文
				</span>
			</div>
			<div className="flex gap-2.5 p-3">
				<Link
					className="shrink-0"
					onClick={(e) => e.stopPropagation()}
					params={{ username: author.username }}
					to="/users/$username"
				>
					<img
						alt=""
						className="size-8 rounded-full object-cover transition-opacity hover:opacity-80"
						loading="lazy"
						src={avatarUrl(author.avatar_url, author.username)}
					/>
				</Link>
				<div className="min-w-0 flex-1">
					<div className="flex items-baseline gap-1.5">
						<Link
							className="truncate text-sm font-semibold text-foreground hover:underline"
							onClick={(e) => e.stopPropagation()}
							params={{ username: author.username }}
							to="/users/$username"
						>
							{author.username}
						</Link>
						{tweet.created_at && (
							<time
								className="shrink-0 text-[11px] text-muted-foreground"
								title={formatDateTime(tweet.created_at, "long")}
							>
								{formatRelativeTime(new Date(tweet.created_at))}
							</time>
						)}
					</div>
					{tweet.content && (
						<p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
							{tweet.content}
						</p>
					)}
				</div>
			</div>
			{images.length > 0 && (
				<div
					className="px-3 pb-3"
					onClick={(e) => e.stopPropagation()}
					onKeyDown={(e) => {
						if (e.currentTarget.contains(e.target as Node)) e.stopPropagation();
					}}
				>
					<ImageGrid images={images} />
				</div>
			)}
			{tweet.external_tweet && (
				<div className="px-3 pb-3">
					<ExternalTweetCard tweet={tweet.external_tweet} compact />
				</div>
			)}
			{tweet.quoted_tweet && (
				<div className="space-y-2 px-3 pb-3">
					<Link
						to="/tweets/$id"
						params={{ id: tweet.quoted_tweet.id }}
						onClick={(e) => e.stopPropagation()}
						className="block rounded-lg border border-border p-2 text-xs text-muted-foreground hover:bg-accent"
					>
						引用 @{tweet.quoted_tweet.author.username}
						{tweet.quoted_tweet.content && (
							<p className="mt-1 whitespace-pre-wrap text-foreground">
								{tweet.quoted_tweet.content}
							</p>
						)}
					</Link>
					{(tweet.quoted_tweet.images ?? []).length > 0 && (
						<div
							onClick={(e) => e.stopPropagation()}
							onKeyDown={(e) => {
								if (e.currentTarget.contains(e.target as Node)) e.stopPropagation();
							}}
						>
							<ImageGrid
								images={(tweet.quoted_tweet.images ?? []).map((url) => ({
									url,
									thumbnail: contentImageUrl(url, { width: 400 }),
								}))}
							/>
						</div>
					)}
					{tweet.quoted_tweet.external_tweet && (
						<ExternalTweetCard tweet={tweet.quoted_tweet.external_tweet} compact />
					)}
				</div>
			)}
		</div>
	);
}
