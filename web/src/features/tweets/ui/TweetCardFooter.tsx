import type { Tweet } from "@entities/tweet/model/types";
import { formatDateTime } from "@shared/lib/date";
import { AffectionHeart } from "@shared/ui/affection-heart";
import { Link } from "@tanstack/react-router";
import { Button } from "@violet/ui";
import { ChartNoAxesColumn, MessageCircle, Repeat2, Share2 } from "lucide-react";
import type { MouseEventHandler } from "react";

/** 仅提供本站互动，不包含 X 原站操作。 */
export interface TweetCardFooterProps {
	/** 本站推文及互动计数。 */
	tweet: Tweet;
	/** 详情卡先展示发布时间与统计，再展示互动入口。 */
	isDetail: boolean;
	/** 点赞请求未完成时禁止重复操作。 */
	isLikePending: boolean;
	/** 只有服务端确认点赞后才播放成功反馈。 */
	likeFeedback: boolean;
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
	likeFeedback,
	onLike,
	onQuote,
	onShare,
}: TweetCardFooterProps) {
	return (
		<>
			{isDetail && (
				<div className="mt-2 flex flex-col gap-3 text-sm text-muted-foreground">
					<p className="flex flex-wrap items-baseline gap-x-2 tabular-nums">
						<time dateTime={tweet.created_at}>
							{formatDateTime(tweet.created_at, "long")}
						</time>
						<span aria-hidden="true">·</span>
						<span>
							<b className="font-medium text-foreground">{tweet.view_count}</b> 次浏览
						</span>
					</p>
					<dl className="flex flex-wrap gap-x-5 gap-y-1 border-edge-hairline border-y py-3 tabular-nums">
						{[
							{ label: "评论", count: tweet.comment_count },
							{ label: "引用", count: tweet.quote_count },
							{ label: "喜欢", count: tweet.like_count },
						].map(({ label, count }) => (
							<div key={label} className="flex flex-row-reverse items-baseline gap-1">
								<dt>{label}</dt>
								<dd className="font-medium text-foreground">{count}</dd>
							</div>
						))}
					</dl>
				</div>
			)}
			<footer className="flex flex-wrap items-center justify-between gap-1 pt-2 text-sm text-muted-foreground">
				<Button asChild variant="ghost" size="sm">
					<Link
						to="/tweets/$id"
						params={{ id: tweet.id }}
						search={isDetail ? true : undefined}
						hash="comments"
						hashScrollIntoView={{ block: "nearest" }}
						aria-label={`查看评论（${tweet.comment_count}）`}
						onClick={(event) => event.stopPropagation()}
					>
						<MessageCircle />
						{tweet.comment_count}
					</Link>
				</Button>
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
					<AffectionHeart selected={tweet.is_liked} feedback={likeFeedback ? 1 : 0} />
					{tweet.like_count}
				</Button>
				{!isDetail && (
					<span className="inline-flex items-center gap-1.5 tabular-nums">
						<ChartNoAxesColumn aria-hidden className="size-4" />
						<span className="sr-only">浏览 </span>
						{tweet.view_count}
					</span>
				)}
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
		</>
	);
}
