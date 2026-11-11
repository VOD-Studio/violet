import type { QuotedTweet, Tweet } from "@entities/tweet/model/types";
import { formatRelativeTime } from "@shared/lib/date";
import { avatarUrl, contentImageUrl } from "@shared/lib/image-url";
import { TWEET_MESSAGES } from "@shared/lib/tweet-messages";
import { Button, QuoteCard } from "@violet/ui";
import { CircleAlert, X } from "lucide-react";
import type { TweetComposerImage } from "../hooks/useTweetComposerImages";
import styles from "./TweetComposer.module.css";

/** 发布草稿的附图与本站引用，不拥有上传或提交状态。 */
export interface TweetComposerAttachmentsProps {
	images: TweetComposerImage[];
	quotedTweet?: Tweet | QuotedTweet;
	disabled: boolean;
	onRemoveImage: (id: number) => void;
	onCancelQuote?: () => void;
}

export function TweetComposerAttachments({
	images,
	quotedTweet,
	disabled,
	onRemoveImage,
	onCancelQuote,
}: TweetComposerAttachmentsProps) {
	return (
		<>
			{images.length > 0 && (
				<div className="flex flex-wrap gap-2" role="group" aria-label="已添加图片">
					{images.map((image) => (
						<div
							key={image.id}
							className="relative size-24 overflow-hidden rounded-lg border border-border"
						>
							<img
								src={
									image.status === "done"
										? contentImageUrl(image.url, { width: 200 })
										: image.preview
								}
								alt=""
								className="size-full object-cover"
							/>
							{image.status === "uploading" && (
								<div
									role="progressbar"
									aria-label="图片上传"
									aria-valuenow={image.progress}
									aria-valuemin={0}
									aria-valuemax={100}
									className="absolute inset-x-0 bottom-0 h-1 bg-secondary"
								>
									<div
										className="h-full bg-primary"
										style={{ width: `${image.progress}%` }}
									/>
								</div>
							)}
							{image.status === "error" && (
								<div
									role="alert"
									className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-destructive text-destructive-foreground"
								>
									<CircleAlert className="size-4" />
									<span className="text-xs">上传失败</span>
								</div>
							)}
							<button
								type="button"
								aria-label="移除图片"
								disabled={disabled}
								onClick={() => onRemoveImage(image.id)}
								className={`${styles.action} absolute top-0 right-0`}
							>
								<span className="inline-flex size-6 items-center justify-center rounded-md bg-background/90">
									<X className="size-3.5" />
								</span>
							</button>
						</div>
					))}
				</div>
			)}
			{quotedTweet && (
				<section aria-label="引用的推文">
					<QuoteCard
						authorName={quotedTweet.author.username}
						authorAvatar={avatarUrl(
							quotedTweet.author.avatar_url,
							quotedTweet.author.username,
						)}
						time={formatRelativeTime(new Date(quotedTweet.created_at))}
						content={quotedTweet.content}
						imageSrc={
							quotedTweet.images[0]
								? contentImageUrl(quotedTweet.images[0].url, { width: 128 })
								: undefined
						}
						nested={
							quotedTweet.external_tweet ||
							quotedTweet.quote_of ||
							("quoted_tweet" in quotedTweet && quotedTweet.quoted_tweet)
								? TWEET_MESSAGES.quoteNested
								: undefined
						}
						action={
							onCancelQuote && (
								<Button
									iconOnly
									type="button"
									variant="ghost"
									size="md"
									aria-label="取消引用"
									disabled={disabled}
									onClick={onCancelQuote}
								>
									<X className="size-4" />
								</Button>
							)
						}
					/>
				</section>
			)}
		</>
	);
}
