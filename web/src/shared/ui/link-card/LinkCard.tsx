import type { TweetLinkCard } from "@entities/tweet/model/types";
import { contentImageUrl } from "@shared/lib/image-url";
import { cn } from "cn";

export interface LinkCardProps {
	/** 卡片数据（推文 DTO 的 link_cards 元素） */
	card: TweetLinkCard;
	/** 紧凑变体：嵌套引用等窄容器里缩小内边距与封面高 */
	compact?: boolean;
	className?: string;
}

/** 从 URL 提取展示域名（https://example.com/a → example.com）。 */
function hostOf(raw: string): string {
	try {
		return new URL(raw).host;
	} catch {
		return raw;
	}
}

/**
 * OG 链接卡片：封面 + 标题 + 描述 + 域名，整卡新标签跳转原文。
 *
 * 无封面时渲染纯文本卡；标题缺失用域名兜底。消费推文 DTO 的 link_cards，
 * 也供未来评论、文章等位置复用（数据来自同一通用端点/DTO 组装）。
 */
export function LinkCard({ card, compact = false, className }: LinkCardProps) {
	const host = hostOf(card.url);
	const title = card.title || host;
	return (
		<a
			href={card.url}
			target="_blank"
			rel="noopener noreferrer"
			onClick={(e) => e.stopPropagation()}
			className={cn(
				"flex items-stretch overflow-hidden rounded-xl border border-border bg-muted/30 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
				compact ? "min-h-16" : "min-h-20",
				className,
			)}
		>
			<div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-3 py-2">
				<span className="truncate text-sm font-medium text-foreground">{title}</span>
				{card.description && (
					<span className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
						{card.description}
					</span>
				)}
				<span className="truncate text-xs text-muted-foreground">{card.site_name || host}</span>
			</div>
			{card.image_url && (
				<img
					src={contentImageUrl(card.image_url, { width: 320 })}
					alt=""
					loading="lazy"
					// 封面区固定宽度按比例裁切；左缘用渐隐遮罩弱化裁切边（图片本身不缩放变形）。
					className={cn("w-28 shrink-0 object-cover sm:w-36", compact && "w-20 sm:w-28")}
				/>
			)}
		</a>
	);
}
