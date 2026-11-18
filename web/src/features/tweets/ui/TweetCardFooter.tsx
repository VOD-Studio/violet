import type { Tweet } from "@entities/tweet/model/types";
import { Link } from "@tanstack/react-router";
import { Button } from "@violet/ui";
import { ChartNoAxesColumn, Heart, MessageCircle, Repeat2, Share2 } from "lucide-react";
import type { MouseEventHandler } from "react";

/** 仅提供本站互动，不包含 X 原站操作。 */
export interface TweetCardFooterProps {
	/** 本站推文及互动计数。 */
	tweet: Tweet;
	/** 详情页不显示评论导航，评论区由页面承载。 */
	isDetail: boolean;
	/** 点赞请求未完成时禁止重复操作。 */
	isLikePending: boolean;
	/** 本站点赞操作。 */
	onLike: MouseEventHandler<HTMLButtonElement>;
	/** 打开引用编辑器。 */
	onQuote: MouseEventHandler<HTMLButtonElement>;
	/** 打开聊天分享入口。 */
	onShare: MouseEventHandler<HTMLButtonElement>;
}

/** 只执行本站互动，不生成 X 意图链接。 */
export function TweetCardFooter({
	tweet,
	isDetail,
	isLikePending,
	onLike,
	onQuote,
	onShare,
}: TweetCardFooterProps) {
	return (
		<footer className="flex flex-wrap items-center justify-between gap-1 pt-2 text-sm text-muted-foreground">
			{!isDetail && (
				<Button asChild variant="ghost" size="sm">
					<Link
						to="/tweets/$id"
						params={{ id: tweet.id }}
						hash="comments"
						aria-label={`查看评论（${tweet.comment_count}）`}
						onClick={(event) => event.stopPropagation()}
					>
						<MessageCircle />
						{tweet.comment_count}
					</Link>
				</Button>
			)}
			<Button
				type="button"
				variant="ghost"
				size="sm"
				data-testid="quote-button"
				aria-label="引用推文"
				onClick={onQuote}
			>
				<Repeat2 />
				{tweet.quote_count}
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				data-testid="like-button"
				aria-label={tweet.is_liked ? "取消点赞" : "点赞推文"}
				aria-pressed={tweet.is_liked}
				onClick={onLike}
				loading={isLikePending}
			>
				<Heart className={tweet.is_liked ? "fill-current" : undefined} />
				{tweet.like_count}
			</Button>
			<span className="inline-flex items-center gap-1.5 tabular-nums">
				<ChartNoAxesColumn aria-hidden className="size-4" />
				<span className="sr-only">浏览 </span>
				{tweet.view_count}
			</span>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				iconOnly
				data-testid="share-button"
				aria-label="分享推文"
				onClick={onShare}
			>
				<Share2 />
			</Button>
		</footer>
	);
}
