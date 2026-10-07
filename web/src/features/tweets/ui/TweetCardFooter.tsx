import type { Tweet } from "@entities/tweet/model/types";
import { Link } from "@tanstack/react-router";
import { Heart, MessageCircle, Repeat2, Share2 } from "lucide-react";
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
		<footer
			className={`grid gap-1 pt-2 text-xs text-muted-foreground ${isDetail ? "grid-cols-3" : "grid-cols-4"}`}
		>
			{!isDetail && (
				<Link
					to="/tweets/$id"
					params={{ id: tweet.id }}
					aria-label={`查看评论（${tweet.comment_count}）`}
					onClick={(event) => event.stopPropagation()}
					className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg text-muted-foreground! no-underline! transition-colors hover:bg-muted hover:text-primary!"
				>
					<MessageCircle className="size-4 shrink-0" />
					<span>评论{tweet.comment_count > 0 ? ` ${tweet.comment_count}` : ""}</span>
				</Link>
			)}
			<button
				type="button"
				data-testid="quote-button"
				aria-label="引用推文"
				onClick={onQuote}
				className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg transition-colors hover:bg-muted hover:text-primary"
			>
				<Repeat2 className="size-4 shrink-0" />
				<span>引用{tweet.quote_count > 0 ? ` ${tweet.quote_count}` : ""}</span>
			</button>
			<button
				type="button"
				data-testid="like-button"
				aria-label={tweet.is_liked ? "取消点赞" : "点赞推文"}
				aria-pressed={tweet.is_liked}
				onClick={onLike}
				disabled={isLikePending}
				className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg transition-colors hover:bg-muted ${
					tweet.is_liked ? "font-medium text-primary" : "hover:text-primary"
				}`}
			>
				<Heart className={`size-4 shrink-0 ${tweet.is_liked ? "fill-current" : ""}`} />
				<span>点赞{tweet.like_count > 0 ? ` ${tweet.like_count}` : ""}</span>
			</button>
			<button
				type="button"
				data-testid="share-button"
				aria-label="分享到聊天"
				onClick={onShare}
				className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg transition-colors hover:bg-muted hover:text-primary"
			>
				<Share2 className="size-4 shrink-0" />
				<span>聊天</span>
			</button>
		</footer>
	);
}
