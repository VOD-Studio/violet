/**
 * TweetShareCard - 聊天消息内嵌的分享推文卡片。
 *
 * 渲染分享到聊天的推文快照（作者头像/用户名/相对时间 + 完整正文 + 图片网格）；
 * `tweet.is_deleted` 时渲染"该推文已被删除"占位，不展示任何原内容字段
 * （被分享推文物理删除后，后端联结未命中，见 CONTEXT.md「推文分享消息」词条）。
 * 整卡可点击跳转 `/tweets/$id`；头像/用户名单独可跳 `/users/$username`
 * （stopPropagation，避免触发整卡的详情页跳转）。
 */
import { avatarUrl, contentImageUrl } from "@shared/lib/image-url";
import { ImageGrid, type ImageGridImage } from "@shared/ui/image-grid";
import { Link, useNavigate } from "@tanstack/react-router";
import { format, formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { AlertCircle, MessageSquareQuote } from "lucide-react";
import type { SharedTweet } from "../model/types";

export interface TweetShareCardProps {
	/** 分享的推文快照 */
	tweet: SharedTweet;
}

export function TweetShareCard({ tweet }: TweetShareCardProps) {
	const navigate = useNavigate();

	if (tweet.is_deleted || !tweet.author) {
		return (
			<div className="flex items-center gap-2 rounded-xl border border-dashed border-edge-hairline bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
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
			className="w-72 max-w-full cursor-pointer overflow-hidden rounded-xl border border-neon-cyan/30 bg-card/80 backdrop-blur-md transition-colors hover:border-neon-cyan/60 hover:bg-card/95"
			onClick={openDetail}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
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
								title={format(new Date(tweet.created_at), "PPPpp", {
									locale: zhCN,
								})}
							>
								{formatDistanceToNow(new Date(tweet.created_at), {
									addSuffix: true,
									locale: zhCN,
								})}
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
					onKeyDown={(e) => e.stopPropagation()}
				>
					<ImageGrid images={images} />
				</div>
			)}
		</div>
	);
}
