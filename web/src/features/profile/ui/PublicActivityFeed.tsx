import { TweetCardImages } from "@features/tweets/ui/TweetCardImages";
import TweetContent from "@features/tweets/ui/TweetContent";
import { EmojiText } from "@shared/ui/emoji-text";
import { Link } from "@tanstack/react-router";
import { Empty } from "@violet/ui";
import { FileText, MessageCircle, PencilLine, Send } from "lucide-react";
import type { ReactNode } from "react";
import type { PublicActivity } from "../model/public-profile";

function SourceLink({ item, children }: { item: PublicActivity; children: ReactNode }) {
	const isTweet = item.type === "tweet" || item.type === "tweet_comment";
	return isTweet ? (
		<Link
			to="/tweets/$id"
			params={{ id: item.url.slice("/tweets/".length) }}
			className="font-semibold hover:underline"
		>
			{children}
		</Link>
	) : (
		<Link
			to="/blog/$slug"
			params={{ slug: item.url.slice("/blog/".length) }}
			className="font-semibold hover:underline"
		>
			{children}
		</Link>
	);
}

const verbs = {
	post: "发表了文章",
	tweet: "发布了推文",
	comment: "评论了",
	annotation: "批注了",
	tweet_comment: "评论了推文",
};
const icons = {
	post: FileText,
	tweet: Send,
	comment: MessageCircle,
	annotation: PencilLine,
	tweet_comment: MessageCircle,
};

/** 按服务端 UTC 日期分组，保留原文入口、批注选区和真实配图。 */
export function PublicActivityFeed({ items }: { items: PublicActivity[] }) {
	if (items.length === 0)
		return (
			<Empty
				variant="plain"
				title="还没有公开内容"
				description="这个分类暂时没有可见的内容。"
			/>
		);
	let previousDay = "";
	return (
		<div>
			{items.map((item) => {
				const day = item.created_at.slice(0, 10);
				const showDay = day !== previousDay;
				previousDay = day;
				const Icon = icons[item.type];
				return (
					<div key={`${item.type}:${item.id}`}>
						{showDay && (
							<h3 className="mt-7 mb-2 text-xs text-muted-foreground">
								<time dateTime={day}>{day}</time> · UTC
							</h3>
						)}
						<article className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3 border-t border-border py-5 sm:gap-4">
							<span className="flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
								<Icon className="size-3.5" aria-hidden="true" />
							</span>
							<div className="min-w-0">
								<p className="text-sm text-muted-foreground">
									{verbs[item.type]}{" "}
									<SourceLink item={item}>{item.title || "查看原文"}</SourceLink>
								</p>
								{item.selected_text && (
									<blockquote className="mt-3 rounded-xl bg-muted p-3 text-sm leading-relaxed">
										<mark className="bg-selected text-foreground">
											{item.selected_text}
										</mark>
									</blockquote>
								)}
								{item.body && (
									<div className="mt-3 text-sm leading-relaxed whitespace-pre-wrap wrap-break-word">
										{item.type === "tweet" ? (
											<TweetContent content={item.body} />
										) : (
											<EmojiText text={item.body} />
										)}
									</div>
								)}
								{item.cover_image && (
									<SourceLink item={item}>
										<img
											src={item.cover_image}
											alt=""
											loading="lazy"
											className="mt-3 aspect-video w-full max-w-105 rounded-xl object-cover"
										/>
									</SourceLink>
								)}
								<TweetCardImages images={item.images} />
								<p className="mt-3 text-xs text-muted-foreground">
									<time dateTime={item.created_at}>
										{item.created_at.slice(11, 16)} UTC
									</time>
								</p>
							</div>
						</article>
					</div>
				);
			})}
		</div>
	);
}
