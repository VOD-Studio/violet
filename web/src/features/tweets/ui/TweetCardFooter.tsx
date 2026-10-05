import type { Tweet } from "@entities/tweet/model/types";
import { formatDateTime } from "@shared/lib/date";
import { Link } from "@tanstack/react-router";
import { Heart, MessageCircle, Repeat2, Share2 } from "lucide-react";
import type { MouseEventHandler } from "react";

/** 本站推文的时间与互动入口。 */
export interface TweetCardFooterProps {
	/** 本站推文及互动计数。 */
	tweet: Tweet;
	/** 详情页显示完整时间，评论区由页面承载。 */
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
		<>
			{isDetail && (
				<time
					dateTime={tweet.created_at}
					className="block text-xs text-muted-foreground py-2 border-y border-edge-hairline my-1"
					title={formatDateTime(tweet.created_at, "long")}
				>
					{formatDateTime(tweet.created_at)}
				</time>
			)}
			<div
				className={`flex items-center gap-8 pt-3 text-xs text-muted-foreground ${isDetail ? "justify-around" : ""}`}
			>
				{!isDetail && (
					<Link
						to="/tweets/$id"
						params={{ id: tweet.id }}
						aria-label={`查看评论（${tweet.comment_count}）`}
						onClick={(event) => event.stopPropagation()}
						className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors hover:bg-neon-blue/10 hover:text-neon-blue"
					>
						<MessageCircle className="size-4" />
						<span>{tweet.comment_count}</span>
					</Link>
				)}
				<button
					type="button"
					data-testid="quote-button"
					aria-label="引用推文"
					onClick={onQuote}
					className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors hover:bg-neon-green/10 hover:text-neon-green"
				>
					<Repeat2 className="size-4" />
					<span>{tweet.quote_count}</span>
				</button>
				<button
					type="button"
					data-testid="like-button"
					aria-label={tweet.is_liked ? "取消点赞" : "点赞推文"}
					onClick={onLike}
					disabled={isLikePending}
					className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors ${
						tweet.is_liked
							? "font-medium text-neon-pink hover:bg-neon-pink/10"
							: "hover:bg-neon-pink/10 hover:text-neon-pink"
					}`}
				>
					<Heart
						className={`size-4 ${tweet.is_liked ? "fill-current text-neon-pink" : ""}`}
					/>
					<span>{tweet.like_count}</span>
				</button>
				<button
					type="button"
					data-testid="share-button"
					aria-label="分享到聊天"
					onClick={onShare}
					className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors hover:bg-neon-cyan/10 hover:text-neon-cyan"
				>
					<Share2 className="size-4" />
				</button>
			</div>
		</>
	);
}
