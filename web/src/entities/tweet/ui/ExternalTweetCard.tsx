import { formatDateTime } from "@shared/lib/date";
import { validateUrl } from "@shared/lib/url";
import { ImageGrid } from "@shared/ui/image-grid";
import { AlertCircle, BadgeCheck, ExternalLink, Play } from "lucide-react";
import type { ExternalTweet } from "../model/types";

/** 原文展示数据；本站转发者与互动由外层推文卡片展示。 */
export interface ExternalTweetCardProps {
	tweet: ExternalTweet;
	compact?: boolean;
}

/** 展示保存到本站的 X 原文，只有链接和图片交互阻止外层卡片导航。 */
export function ExternalTweetCard({ tweet, compact = false }: ExternalTweetCardProps) {
	return <SourceCard tweet={tweet} compact={compact} nested={false} />;
}

function SourceCard({ tweet, compact, nested }: ExternalTweetCardProps & { nested: boolean }) {
	const snapshot = tweet.availability === "available" ? tweet.snapshot : null;
	const sourceLink = validateUrl(tweet.canonical_url) === null ? tweet.canonical_url : undefined;
	const linkClass =
		"inline-flex items-center gap-1 rounded text-xs text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring";

	if (!snapshot) {
		const message =
			tweet.availability === "deleted"
				? "原推文已删除"
				: tweet.availability === "private"
					? "原推文已转为私密"
					: "原文暂不可用";
		return (
			<article
				aria-label="X 原文"
				className="space-y-2 rounded-xl border border-border bg-muted p-3 text-sm text-muted-foreground"
			>
				<p className="flex items-center gap-2">
					<AlertCircle className="size-4 shrink-0" />
					{message}
				</p>
				{sourceLink && (
					<a
						href={sourceLink}
						target="_blank"
						rel="noopener noreferrer"
						onClick={(e) => e.stopPropagation()}
						onKeyDown={(e) => e.stopPropagation()}
						className={linkClass}
					>
						在 X 查看原文
						<ExternalLink className="size-3" />
					</a>
				)}
			</article>
		);
	}

	const { author } = snapshot;
	const photos = (snapshot.media ?? []).filter((media) => media.kind === "photo");
	const posters = (snapshot.media ?? []).filter((media) => media.kind !== "photo");
	return (
		<article
			aria-label="X 原文"
			className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-3 text-foreground sm:p-4"
		>
			<header className="flex items-center gap-2">
				<a
					href={author.url}
					target="_blank"
					rel="noopener noreferrer"
					onClick={(e) => e.stopPropagation()}
					onKeyDown={(e) => e.stopPropagation()}
					className="flex min-w-0 flex-1 items-center gap-2 rounded focus-visible:outline-2 focus-visible:outline-ring"
				>
					{author.avatar_url ? (
						<img
							src={author.avatar_url}
							alt=""
							loading="lazy"
							className="size-8 shrink-0 rounded-full object-cover"
						/>
					) : (
						<span
							aria-hidden
							className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium"
						>
							{[...author.name][0] ?? "X"}
						</span>
					)}
					<div className="min-w-0">
						<p className="flex items-center gap-1 text-sm font-semibold">
							<span className="truncate">{author.name}</span>
							{author.verified && (
								<BadgeCheck aria-label="原作者已认证" className="size-4 shrink-0" />
							)}
						</p>
						<p className="truncate text-xs text-muted-foreground">@{author.handle}</p>
					</div>
				</a>
				<span className="shrink-0 rounded bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
					X 原文
				</span>
			</header>
			<p
				className={`whitespace-pre-wrap wrap-break-word leading-relaxed ${compact ? "text-xs" : "text-sm"}`}
			>
				{snapshot.segments?.length
					? snapshot.segments.map((segment, index) =>
							segment.url && validateUrl(segment.url) === null ? (
								<a
									key={`${index}:${segment.text}`}
									href={segment.url}
									target="_blank"
									rel="noopener noreferrer"
									onClick={(e) => e.stopPropagation()}
									onKeyDown={(e) => e.stopPropagation()}
									className="rounded text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
								>
									{segment.text}
								</a>
							) : (
								<span key={`${index}:${segment.text}`}>{segment.text}</span>
							),
						)
					: snapshot.text}
			</p>
			{photos.length > 0 && (
				<div
					onClick={(e) => e.stopPropagation()}
					onKeyDown={(e) => {
						if (e.currentTarget.contains(e.target as Node)) e.stopPropagation();
					}}
				>
					<ImageGrid
						images={photos.map((media) => ({
							url: media.url,
							thumbnail: media.thumbnail_url ? media.thumbnail_url : undefined,
							width: media.width,
							height: media.height,
							alt: media.alt,
						}))}
					/>
				</div>
			)}
			{posters.map((media) => (
				<a
					key={media.file_id}
					href={sourceLink}
					target="_blank"
					rel="noopener noreferrer"
					onClick={(e) => e.stopPropagation()}
					onKeyDown={(e) => e.stopPropagation()}
					className="block overflow-hidden rounded-xl border border-border focus-visible:outline-2 focus-visible:outline-ring"
				>
					<img
						src={media.thumbnail_url ? media.thumbnail_url : media.url}
						alt={media.alt ? media.alt : "原文视频封面"}
						loading="lazy"
						className="max-h-72 w-full object-contain bg-muted"
					/>
					<span className="flex items-center gap-2 bg-muted px-3 py-2 text-xs text-muted-foreground">
						<Play className="size-4" />
						{media.kind === "animated_gif" ? "GIF" : "视频"} · 在 X 查看
					</span>
				</a>
			))}
			{!nested && tweet.quoted_tweet && (
				<SourceCard tweet={tweet.quoted_tweet} compact nested />
			)}
			{snapshot.quote_url && (nested || !tweet.quoted_tweet) && (
				<a
					href={snapshot.quote_url}
					target="_blank"
					rel="noopener noreferrer"
					onClick={(e) => e.stopPropagation()}
					onKeyDown={(e) => e.stopPropagation()}
					className={linkClass}
				>
					查看引用原文
					<ExternalLink className="size-3" />
				</a>
			)}
			{(snapshot.warnings ?? []).length > 0 && (
				<p className="text-xs text-muted-foreground">{snapshot.warnings?.join("；")}</p>
			)}
			<footer className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
				<time dateTime={snapshot.published_at}>
					原文 · {formatDateTime(snapshot.published_at)}
				</time>
				{sourceLink && (
					<a
						href={sourceLink}
						target="_blank"
						rel="noopener noreferrer"
						onClick={(e) => e.stopPropagation()}
						onKeyDown={(e) => e.stopPropagation()}
						className={linkClass}
					>
						在 X 查看原文
						<ExternalLink className="size-3" />
					</a>
				)}
			</footer>
		</article>
	);
}
