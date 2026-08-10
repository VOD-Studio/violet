/**
 * TweetCard - 推文卡片（时间线 / 用户主页 / 详情页共用）
 *
 * 展示：作者头像 + 用户名 + 相对时间 + 正文 + 图片网格 + 赞数占位。
 * 交互（T3）：
 *   - 整卡可点进详情页（/tweets/$id），图片网格与删除按钮 stopPropagation 不触发导航
 *   - 作者本人或持 tweet:delete-any 者可见删除按钮，二次确认后调用 useDeleteTweet
 *
 * variant="detail" 时放大展示：完整时间戳（替代相对时间）+ 更大头像。
 * 详情页是后续 P2 评论区、P3 转发链接的落点，结构上预留。
 */

import type { Tweet } from "@entities/tweet/model/types";
import { useMe } from "@features/auth/api/queries";
import { useHasPermission } from "@features/auth/hooks/usePermissions";
import { useDeleteTweet, useToggleLikeTweet } from "@features/tweets/api/mutations";
import { avatarUrl, contentImageUrl } from "@shared/lib/image-url";
import { ConfirmDialog } from "@shared/ui/confirm-dialog";
import { ImageGrid, type ImageGridImage } from "@shared/ui/image-grid";
import { Modal } from "@shared/ui/modal/components/Modal";
import { SpotlightCard } from "@shared/vendor/react-bits/SpotlightCard";
import { Link, useNavigate } from "@tanstack/react-router";
import { format, formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { AlertCircle, Heart, MessageCircle, Repeat2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import TweetComposer from "./TweetComposer";
import TweetContent from "./TweetContent";
export type TweetCardVariant = "timeline" | "detail";

export interface TweetCardProps {
	/** 推文数据 */
	tweet: Tweet;
	/** 展示形态：timeline（默认，时间线/用户主页紧凑卡片）或 detail（详情页放大版） */
	variant?: TweetCardVariant;
	/** 删除成功后回调（详情页用以导航回时间线；时间线卡片可不传，缓存已自动联动） */
	onDeleted?: (tweet: Tweet) => void;
}

const TweetCard = ({ tweet, variant = "timeline", onDeleted }: TweetCardProps) => {
	const me = useMe();
	const navigate = useNavigate();
	const canDeleteAny = useHasPermission("tweet:delete-any");
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [quoteModalOpen, setQuoteModalOpen] = useState(false);
	const deleteTweet = useDeleteTweet(tweet.id);
	const toggleLike = useToggleLikeTweet(tweet);

	const handleLikeClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (!me.data) {
			toast.info("请先登录后再点赞");
			navigate({ to: "/login" });
			return;
		}
		toggleLike.mutate();
	};

	const handleQuoteClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (!me.data) {
			toast.info("请先登录后再引用转发");
			navigate({ to: "/login" });
			return;
		}
		setQuoteModalOpen(true);
	};
	// 正文非空才渲染（纯图推文 content 为空串）
	const hasContent = tweet.content.length > 0;
	const isDetail = variant === "detail";

	const gridImages: ImageGridImage[] = tweet.images.map((url) => ({
		url,
		// 网格用 400px 缩略图省带宽；原图留给 ImagePreview 点开加载
		thumbnail: contentImageUrl(url, { width: 400 }),
	}));

	// 作者本人 或 持 tweet:delete-any 权限者可见删除按钮
	const isAuthor = !!me.data && me.data.id === tweet.author.id;
	const canDelete = !!me.data && (isAuthor || canDeleteAny);

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
			onError: (err) => toast.error(err.message),
		});
	};

	return (
		<>
			<SpotlightCard
				className={`group flex gap-3 p-4 sm:p-5 transition-colors ${
					isDetail ? "flex-col" : "flex-row"
				}`}
				// 仅 timeline 形态整卡可点进详情；详情页不自我链接
				role={isDetail ? undefined : "button"}
				tabIndex={isDetail ? undefined : 0}
				onClick={isDetail ? undefined : openDetail}
				onKeyDown={
					isDetail
						? undefined
						: (e) => {
								if (e.key === "Enter" || e.key === " ") {
									e.preventDefault();
									openDetail();
								}
							}
				}
			>
				{/* 左侧头像（Timeline 视图） */}
				{!isDetail && (
					<Link
						to="/users/$username"
						params={{ username: tweet.author.username }}
						onClick={(e) => e.stopPropagation()}
						className="shrink-0 self-start"
					>
						<img
							src={avatarUrl(tweet.author.avatar_url, tweet.author.username)}
							alt=""
							loading="lazy"
							className="size-10 rounded-full object-cover transition-opacity hover:opacity-80"
						/>
					</Link>
				)}

				{/* 主体部分 */}
				<div className="flex flex-1 min-w-0 flex-col gap-2.5">
					{/* 头部：作者信息 + 时间 + 删除按钮 */}
					<div className="flex items-center justify-between gap-2">
						<div className="flex min-w-0 items-center gap-2">
							{isDetail && (
								<Link
									to="/users/$username"
									params={{ username: tweet.author.username }}
									onClick={(e) => e.stopPropagation()}
									className="shrink-0"
								>
									<img
										src={avatarUrl(
											tweet.author.avatar_url,
											tweet.author.username,
										)}
										alt=""
										loading="lazy"
										className="size-12 rounded-full object-cover transition-opacity hover:opacity-80"
									/>
								</Link>
							)}
							<div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 min-w-0">
								<Link
									to="/users/$username"
									params={{ username: tweet.author.username }}
									onClick={(e) => e.stopPropagation()}
									className="truncate font-semibold text-foreground hover:underline text-sm sm:text-base"
								>
									{tweet.author.username}
								</Link>
								{!isDetail && (
									<>
										<span className="text-muted-foreground/50 select-none text-xs">
											·
										</span>
										<time
											className="shrink-0 text-xs text-muted-foreground hover:underline"
											title={format(new Date(tweet.created_at), "PPPpp", {
												locale: zhCN,
											})}
										>
											{formatDistanceToNow(new Date(tweet.created_at), {
												addSuffix: true,
												locale: zhCN,
											})}
										</time>
									</>
								)}
							</div>
						</div>
						{/* 删除按钮 */}
						{canDelete && (
							<button
								type="button"
								aria-label="删除推文"
								className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
								onClick={(e) => {
									e.stopPropagation();
									setConfirmOpen(true);
								}}
							>
								<Trash2 className="size-4" />
							</button>
						)}
					</div>

					{/* 正文 */}
					{hasContent && (
						<TweetContent
							content={tweet.content}
							className={
								isDetail
									? "text-base sm:text-lg leading-relaxed my-1"
									: "text-sm sm:text-[15px] leading-relaxed"
							}
						/>
					)}

					{/* 图片网格 */}
					{gridImages.length > 0 && (
						<div
							onClick={(e) => e.stopPropagation()}
							onKeyDown={(e) => e.stopPropagation()}
							className="w-full my-0.5"
						>
							<ImageGrid images={gridImages} />
						</div>
					)}

					{/* 嵌套引用推文 */}
					{tweet.quoted_tweet && (
						<div
							onClick={(e) => {
								e.stopPropagation();
								if (tweet.quoted_tweet) {
									navigate({
										to: "/tweets/$id",
										params: { id: tweet.quoted_tweet.id },
									});
								}
							}}
							onKeyDown={(e) => {
								if ((e.key === "Enter" || e.key === " ") && tweet.quoted_tweet) {
									e.preventDefault();
									e.stopPropagation();
									navigate({
										to: "/tweets/$id",
										params: { id: tweet.quoted_tweet.id },
									});
								}
							}}
							role="button"
							tabIndex={0}
							className="mt-1 rounded-xl border border-edge-hairline bg-surface/30 p-3 text-xs transition-colors hover:border-foreground/20 hover:bg-surface/50 cursor-pointer"
						>
							<div className="flex items-center gap-2 mb-1.5">
								<img
									src={avatarUrl(
										tweet.quoted_tweet.author.avatar_url,
										tweet.quoted_tweet.author.username,
									)}
									alt={tweet.quoted_tweet.author.username}
									className="size-5 rounded-full object-cover shrink-0"
								/>
								<span className="font-semibold text-foreground truncate">
									{tweet.quoted_tweet.author.username}
								</span>
								<span className="text-muted-foreground text-[11px]">
									·{" "}
									{formatDistanceToNow(new Date(tweet.quoted_tweet.created_at), {
										addSuffix: true,
										locale: zhCN,
									})}
								</span>
							</div>
							{tweet.quoted_tweet.content && (
								<TweetContent
									content={tweet.quoted_tweet.content}
									className="line-clamp-3 text-xs leading-normal text-foreground/90"
								/>
							)}
							{tweet.quoted_tweet.images && tweet.quoted_tweet.images.length > 0 && (
								<div
									className="mt-2"
									onClick={(e) => e.stopPropagation()}
									onKeyDown={(e) => e.stopPropagation()}
									role="presentation"
								>
									<ImageGrid
										images={tweet.quoted_tweet.images.map((url) => ({
											url,
											thumbnail: contentImageUrl(url, { width: 300 }),
										}))}
									/>
								</div>
							)}
						</div>
					)}
					{tweet.quote_of && !tweet.quoted_tweet && (
						<div className="mt-1 flex items-center gap-2 rounded-xl border border-edge-hairline bg-muted/20 p-3 text-xs text-muted-foreground">
							<AlertCircle className="size-4 shrink-0" />
							<span>推文已删除</span>
						</div>
					)}

					{/* 详情页特有：底部完整时间戳 */}
					{isDetail && (
						<time
							className="block text-xs text-muted-foreground py-2 border-y border-edge-hairline my-1"
							title={format(new Date(tweet.created_at), "PPPpp", { locale: zhCN })}
						>
							{format(new Date(tweet.created_at), "yyyy-MM-dd HH:mm", {
								locale: zhCN,
							})}
						</time>
					)}

					{/* 底部互动操作栏 */}
					<div
						className={`flex items-center gap-8 pt-1 text-xs text-muted-foreground ${
							isDetail ? "justify-around" : ""
						}`}
					>
						{!isDetail && (
							<div className="group inline-flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors hover:bg-sky-500/10 hover:text-sky-500 cursor-pointer">
								<MessageCircle className="size-4 transition-transform group-hover:scale-110" />
								<span>{tweet.comment_count}</span>
							</div>
						)}
						<button
							type="button"
							data-testid="quote-button"
							aria-label="引用推文"
							onClick={handleQuoteClick}
							className="group inline-flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors hover:bg-emerald-500/10 hover:text-emerald-500"
						>
							<Repeat2 className="size-4 transition-transform group-hover:scale-110" />
							<span>{tweet.quote_count}</span>
						</button>
						<button
							type="button"
							data-testid="like-button"
							aria-label={tweet.is_liked ? "取消点赞" : "点赞推文"}
							onClick={handleLikeClick}
							disabled={toggleLike.isPending}
							className={`group inline-flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors ${
								tweet.is_liked
									? "font-medium text-rose-500 hover:bg-rose-500/10"
									: "hover:bg-rose-500/10 hover:text-rose-500"
							}`}
						>
							<Heart
								className={`size-4 transition-transform group-hover:scale-110 ${
									tweet.is_liked ? "fill-current text-rose-500" : ""
								}`}
							/>
							<span>{tweet.like_count}</span>
						</button>
					</div>
				</div>
			</SpotlightCard>

			{/* 删除二次确认 */}
			<ConfirmDialog
				open={confirmOpen}
				onOpenChange={setConfirmOpen}
				title="删除推文"
				description="确定要删除这条推文吗？此操作不可撤销。"
				confirmLabel="删除"
				loading={deleteTweet.isPending}
				onConfirm={handleConfirmDelete}
			/>
			{/* 引用弹窗 */}
			<Modal open={quoteModalOpen} onOpenChange={setQuoteModalOpen} title="引用推文">
				<TweetComposer quotedTweet={tweet} onSuccess={() => setQuoteModalOpen(false)} />
			</Modal>
		</>
	);
};

export default TweetCard;
