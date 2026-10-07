import { useShareTweetStore } from "@entities/tweet/model/share-store";
import type { Tweet } from "@entities/tweet/model/types";
import { ExternalTweetCard } from "@entities/tweet/ui/ExternalTweetCard";
import { useMe } from "@features/auth/api/queries";
import { useHasPermission } from "@features/auth/hooks/usePermissions";
import { useDeleteTweet, useToggleLikeTweet } from "@features/tweets/api/mutations";
import { useNavigate } from "@tanstack/react-router";
import { TweetCard as TweetCardLayout } from "@violet/react-tweet";
import { ConfirmDialog, Modal } from "@violet/ui";
import { AlertCircle } from "lucide-react";
import { type MouseEvent, useState } from "react";
import { toast } from "sonner";
import { ExternalTweetActions } from "./ExternalTweetActions";
import { QuotedTweetCard } from "./QuotedTweetCard";
import styles from "./TweetCard.module.css";
import { TweetCardFooter } from "./TweetCardFooter";
import { TweetCardHeader } from "./TweetCardHeader";
import { TweetCardImages } from "./TweetCardImages";
import TweetComposer from "./TweetComposer";
import TweetContent from "./TweetContent";
import { TweetMoreMenu } from "./TweetMoreMenu";

/** 本站推文的列表与详情展示形态。 */
export type TweetCardVariant = "timeline" | "detail";

/** 时间线、个人主页与详情共用；来源跳转、图片和互动保持独立操作。 */
export interface TweetCardProps {
	/** 推文数据。 */
	tweet: Tweet;
	/**
	 * 时间线卡片可整体导航，详情卡片不自我跳转。
	 * @default "timeline"
	 */
	variant?: TweetCardVariant;
	/** 删除成功后回调；列表缓存由 mutation 更新。 */
	onDeleted?: (tweet: Tweet) => void;
}

/** 将本站内容和互动组合到来源无关的推文布局。 */
const TweetCard = ({ tweet, variant = "timeline", onDeleted }: TweetCardProps) => {
	const me = useMe();
	const navigate = useNavigate();
	const canDeleteAny = useHasPermission("tweet:delete-any");
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [quoteModalOpen, setQuoteModalOpen] = useState(false);
	const deleteTweet = useDeleteTweet(tweet.id);
	const toggleLike = useToggleLikeTweet(tweet);
	const openShareTweet = useShareTweetStore((state) => state.open);
	const isDetail = variant === "detail";
	const canDelete = !!me.data && (me.data.id === tweet.author.id || canDeleteAny);

	const handleLikeClick = (event: MouseEvent<HTMLButtonElement>) => {
		event.stopPropagation();
		if (!me.data) {
			toast.info("请先登录后再点赞");
			navigate({ to: "/login" });
			return;
		}
		toggleLike.mutate();
	};

	const handleQuoteClick = (event: MouseEvent<HTMLButtonElement>) => {
		event.stopPropagation();
		if (!me.data) {
			toast.info("请先登录后再引用转发");
			navigate({ to: "/login" });
			return;
		}
		setQuoteModalOpen(true);
	};

	const handleShareClick = (event: MouseEvent<HTMLButtonElement>) => {
		event.stopPropagation();
		if (!me.data) {
			toast.info("请先登录后再分享到聊天");
			navigate({ to: "/login" });
			return;
		}
		openShareTweet({
			id: tweet.id,
			authorUsername: tweet.author.username,
			content: tweet.content,
			imageUrl: tweet.images[0],
			externalTweet: tweet.external_tweet,
			quotedTweet: tweet.quoted_tweet,
		});
	};

	const openDetail = () => {
		navigate({ to: "/tweets/$id", params: { id: tweet.id } });
	};

	const handleConfirmDelete = () => {
		deleteTweet.mutate(undefined, {
			onSuccess: () => {
				toast.success("推文已删除");
				setConfirmOpen(false);
				onDeleted?.(tweet);
			},
			onError: (error) => toast.error(error.message),
		});
	};

	return (
		<>
			<TweetCardLayout
				aria-label={`${tweet.author.username} 的推文`}
				className={isDetail ? styles.card : `${styles.card} ${styles.interactive}`}
				tabIndex={isDetail ? undefined : 0}
				onClick={
					isDetail
						? undefined
						: (event) => {
								const target = event.target;
								if (
									!(target instanceof Element) ||
									!event.currentTarget.contains(target)
								)
									return;
								if (
									target.closest(
										"a, button, input, textarea, select, video, audio, [role='button'], [role='menu'], [role='menuitem'], [contenteditable='true']",
									)
								)
									return;
								if (window.getSelection()?.toString()) return;
								openDetail();
							}
				}
				onKeyDown={
					isDetail
						? undefined
						: (event) => {
								if (
									event.target === event.currentTarget &&
									(event.key === "Enter" || event.key === " ")
								) {
									event.preventDefault();
									openDetail();
								}
							}
				}
				headerSlot={
					<TweetCardHeader
						author={tweet.author}
						tweetId={tweet.id}
						createdAt={tweet.created_at}
						isDetail={isDetail}
						actionsSlot={
							me.data && canDeleteAny && tweet.external_tweet ? (
								<ExternalTweetActions
									tweet={tweet.external_tweet}
									onDelete={canDelete ? () => setConfirmOpen(true) : undefined}
								/>
							) : canDelete ? (
								<TweetMoreMenu onDelete={() => setConfirmOpen(true)} />
							) : undefined
						}
					/>
				}
				contentSlot={
					<TweetContent
						content={tweet.content}
						emote={tweet.emote}
						className={
							isDetail ? "text-base sm:text-lg leading-relaxed my-1" : undefined
						}
					/>
				}
				mediaSlot={<TweetCardImages images={tweet.images} />}
				quoteSlot={
					tweet.external_tweet || tweet.quoted_tweet || tweet.quote_of ? (
						<div className="space-y-2">
							{tweet.external_tweet && (
								<ExternalTweetCard tweet={tweet.external_tweet} />
							)}
							{tweet.quoted_tweet && <QuotedTweetCard tweet={tweet.quoted_tweet} />}
							{tweet.quote_of && !tweet.quoted_tweet && (
								<div className="flex items-center gap-2 rounded-xl border border-edge-hairline bg-muted/20 p-3 text-xs text-muted-foreground">
									<AlertCircle className="size-4 shrink-0" />
									<span>推文已删除</span>
								</div>
							)}
						</div>
					) : null
				}
				footerSlot={
					<TweetCardFooter
						tweet={tweet}
						isDetail={isDetail}
						isLikePending={toggleLike.isPending}
						onLike={handleLikeClick}
						onQuote={handleQuoteClick}
						onShare={handleShareClick}
					/>
				}
			/>
			<ConfirmDialog
				open={confirmOpen}
				onOpenChange={setConfirmOpen}
				title="删除推文"
				description="确定要删除这条推文吗？此操作不可撤销。"
				confirmLabel="删除"
				loading={deleteTweet.isPending}
				onConfirm={handleConfirmDelete}
			/>
			<Modal open={quoteModalOpen} onOpenChange={setQuoteModalOpen} title="引用推文">
				<TweetComposer quotedTweet={tweet} onSuccess={() => setQuoteModalOpen(false)} />
			</Modal>
		</>
	);
};

export default TweetCard;
