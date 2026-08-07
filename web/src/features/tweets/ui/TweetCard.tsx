/**
 * TweetCard - 推文卡片（全局时间线 / 用户主页 / 详情页共用）
 *
 * 展示：作者头像 + 用户名 + 相对时间 + 正文 + 图片网格（≤4）+ 赞数占位。
 *
 * T2 为纯展示卡：导航（→ 详情页 / 用户主页）与互动（点赞 / 删除）在后续 ticket 接入，
 * 此处不渲染死链与无操作按钮，保证每个 ticket 自洽。
 */

import type { Tweet } from "@entities/tweet/model/types";
import { avatarUrl, contentImageUrl } from "@shared/lib/image-url";
import { ImageGrid, type ImageGridImage } from "@shared/ui/image-grid";
import { SpotlightCard } from "@shared/vendor/react-bits/SpotlightCard";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Heart } from "lucide-react";

export interface TweetCardProps {
	/** 推文数据 */
	tweet: Tweet;
}

const TweetCard = ({ tweet }: TweetCardProps) => {
	// 正文非空才渲染（纯图推文 content 为空串）
	const hasContent = tweet.content.length > 0;
	const gridImages: ImageGridImage[] = tweet.images.map((url) => ({
		url,
		// 网格用 400px 缩略图省带宽；原图留给 ImagePreview 点开加载
		thumbnail: contentImageUrl(url, { width: 400 }),
	}));

	return (
		<SpotlightCard className="flex flex-col gap-3 p-4">
			{/* 作者行：头像 + 用户名 + 相对时间 */}
			<div className="flex items-center gap-3">
				<img
					src={avatarUrl(tweet.author.avatar_url, tweet.author.username)}
					alt={tweet.author.username}
					loading="lazy"
					className="size-10 shrink-0 rounded-full object-cover"
				/>
				<div className="min-w-0">
					<span className="block truncate text-sm font-semibold text-foreground">
						{tweet.author.username}
					</span>
					<time className="block text-xs text-muted-foreground">
						{formatDistanceToNow(new Date(tweet.created_at), {
							addSuffix: true,
							locale: zhCN,
						})}
					</time>
				</div>
			</div>

			{/* 正文 */}
			{hasContent && (
				<p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
					{tweet.content}
				</p>
			)}

			{/* 图片网格 */}
			{gridImages.length > 0 && <ImageGrid images={gridImages} />}

			{/* 赞数占位（点赞交互见 T5/T6） */}
			<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
				<Heart className="size-3.5" />
				<span>{tweet.like_count}</span>
			</div>
		</SpotlightCard>
	);
};

export default TweetCard;
