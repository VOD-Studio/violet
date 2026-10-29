import { avatarUrl } from "@shared/lib/image-url";
import { Link, useNavigate } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import type { SharedTweet } from "../model/types";
import { SharedTweetSummary } from "./SharedTweetSummary";

/** 聊天接口按本站推文 ID 读取的当前内容，删除时不展示历史原文。 */
export interface TweetShareCardProps {
	tweet: SharedTweet;
}

export function TweetShareCard({ tweet }: TweetShareCardProps) {
	const navigate = useNavigate();

	if (tweet.is_deleted || !tweet.author) {
		return (
			<div className="flex items-center gap-2 rounded-xl border border-dashed border-edge-hairline bg-muted/20 px-3 py-2.5 text-left text-xs text-muted-foreground">
				<AlertCircle className="size-4 shrink-0" />
				<span>该推文已被删除</span>
			</div>
		);
	}

	const author = tweet.author;
	const openDetail = () => navigate({ to: "/tweets/$id", params: { id: tweet.id } });

	return (
		<div
			aria-label="查看推文"
			className="w-80 max-w-full cursor-pointer rounded-xl border border-border bg-card/80 p-3 text-left backdrop-blur-md transition-colors hover:border-ring hover:bg-card/95"
			onClick={openDetail}
			onKeyDown={(e) => {
				if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
					e.preventDefault();
					openDetail();
				}
			}}
			role="button"
			tabIndex={0}
		>
			<SharedTweetSummary
				tweet={{ ...tweet, author }}
				renderAuthor={(user) => (
					<Link
						className="flex min-w-0 items-center gap-2"
						onClick={(e) => e.stopPropagation()}
						params={{ username: user.username }}
						to="/users/$username"
					>
						<img
							alt=""
							className="size-6 shrink-0 rounded-full object-cover"
							loading="lazy"
							src={avatarUrl(user.avatar_url, user.username)}
						/>
						<span className="truncate text-sm font-semibold text-foreground hover:underline">
							{user.username}
						</span>
					</Link>
				)}
			/>
		</div>
	);
}
