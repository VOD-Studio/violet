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
import { SpotlightCard } from "@shared/vendor/react-bits/SpotlightCard";
import { Link, useNavigate } from "@tanstack/react-router";
import { format, formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Heart, MessageCircle, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
				className="flex flex-col gap-3 p-4"
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
				{/* 作者行：头像 + 用户名 + 时间 + 删除按钮 */}
				<div className="flex items-center justify-between gap-3">
					<div className="flex min-w-0 items-center gap-3">
						<Link
							to="/users/$username"
							params={{ username: tweet.author.username }}
							onClick={(e) => e.stopPropagation()}
							className="group flex min-w-0 items-center gap-3"
						>
							<img
								src={avatarUrl(tweet.author.avatar_url, tweet.author.username)}
								alt={tweet.author.username}
								loading="lazy"
								className={`${isDetail ? "size-12" : "size-10"} shrink-0 rounded-full object-cover transition-opacity group-hover:opacity-80`}
							/>
							<span className="truncate text-sm font-semibold text-foreground group-hover:underline">
								{tweet.author.username}
							</span>
						</Link>
						<time
							className="block text-xs text-muted-foreground"
							title={format(new Date(tweet.created_at), "PPPpp", { locale: zhCN })}
						>
							{isDetail
								? format(new Date(tweet.created_at), "yyyy-MM-dd HH:mm", {
										locale: zhCN,
									})
								: formatDistanceToNow(new Date(tweet.created_at), {
										addSuffix: true,
										locale: zhCN,
									})}
						</time>
					</div>
					{/* 删除按钮：阻止冒泡避免触发卡片导航 */}
					{canDelete && (
						<button
							type="button"
							aria-label="删除推文"
							className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
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
					<p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
						{tweet.content}
					</p>
				)}

				{/* 图片网格：点击预览而非进详情，阻止冒泡 */}
				{gridImages.length > 0 && (
					<div
						onClick={(e) => e.stopPropagation()}
						onKeyDown={(e) => e.stopPropagation()}
						className="contents"
					>
						<ImageGrid images={gridImages} />
					</div>
				)}
				{/* 点赞按钮 + 评论数 */}
				<div className="flex items-center">
					<button
						type="button"
						data-testid="like-button"
						aria-label={tweet.is_liked ? "取消点赞" : "点赞推文"}
						onClick={handleLikeClick}
						disabled={toggleLike.isPending}
						className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors ${
							tweet.is_liked
								? "font-medium text-rose-500 hover:bg-rose-500/10"
								: "text-muted-foreground hover:bg-accent hover:text-foreground"
						}`}
					>
						<Heart
							className={`size-3.5 ${tweet.is_liked ? "fill-current text-rose-500" : ""}`}
						/>
						<span>{tweet.like_count}</span>
					</button>
					{isDetail ? // 详情页评论区就在下方，不重复显示评论数入口
					null : (
						<div className="inline-flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground">
							<MessageCircle className="size-3.5" />
							<span>{tweet.comment_count}</span>
						</div>
					)}
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
		</>
	);
};

export default TweetCard;
