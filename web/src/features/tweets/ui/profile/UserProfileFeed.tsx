import type { Tweet } from "@entities/tweet/model/types";
import { NoSharedElements } from "@shared/lib/view-transition";
import { Link } from "@tanstack/react-router";
import { Button, Segmented, ShimmerSkeleton } from "@violet/ui";
import { useState } from "react";

import TweetCard from "../TweetCard";

export interface UserProfileFeedProps {
	/** 已加载的全部推文，按时间线顺序。 */
	tweets: Tweet[];
	isLoading: boolean;
	error: Error | null;
	hasNextPage: boolean;
	isFetchingNextPage: boolean;
	onLoadMore(): void;
	/** 是否本人主页；本人在没有推文时可直接去发布。 */
	isSelf: boolean;
}

type Tab = "all" | "media";

function Notice({
	title,
	description,
	action,
}: {
	title: string;
	description: string;
	action?: React.ReactNode;
}) {
	return (
		<div role="status" className="flex flex-col items-center gap-2 py-20 text-center">
			<h2 className="text-lg font-semibold tracking-tight">{title}</h2>
			<p className="max-w-sm text-sm text-muted-foreground">{description}</p>
			{action && <div className="mt-3">{action}</div>}
		</div>
	);
}

/**
 * 公开用户页的推文流：全部与图文两个视图，cursor 分页加载更多。
 *
 * 视图切换只过滤已加载的推文，不重新请求。
 */
export function UserProfileFeed({
	tweets,
	isLoading,
	error,
	hasNextPage,
	isFetchingNextPage,
	onLoadMore,
	isSelf,
}: UserProfileFeedProps) {
	const [tab, setTab] = useState<Tab>("all");
	const media = tweets.filter((tweet) => tweet.images && tweet.images.length > 0);
	const visible = tab === "media" ? media : tweets;

	return (
		<section aria-label="推文动态">
			<Segmented
				variant="line"
				value={tab}
				onValueChange={setTab}
				aria-label="推文筛选"
				segments={[
					{ value: "all", label: `全部 ${tweets.length}` },
					{ value: "media", label: `图文 ${media.length}` },
				]}
			/>

			<div className="mt-6">
				{isLoading ? (
					<div className="flex flex-col gap-4">
						{Array.from({ length: 3 }).map((_, index) => (
							<ShimmerSkeleton key={index} className="h-48 w-full rounded-2xl" />
						))}
					</div>
				) : error ? (
					<Notice
						title="加载失败"
						description={error.message || "获取推文时发生未知错误"}
					/>
				) : visible.length === 0 ? (
					<Notice
						title={tab === "media" ? "还没有图文推文" : "还没有推文"}
						description={
							tab === "media"
								? "这里会收纳带图片的推文。"
								: isSelf
									? "发布第一条推文，它会出现在这里。"
									: "这位用户还没有发布推文。"
						}
						action={
							hasNextPage ? (
								<Button
									variant="outline"
									size="sm"
									loading={isFetchingNextPage}
									loadingText="加载中…"
									onClick={onLoadMore}
								>
									继续加载
								</Button>
							) : isSelf && tab === "all" ? (
								<Button size="sm" asChild>
									<Link to="/tweets">去发布</Link>
								</Button>
							) : undefined
						}
					/>
				) : (
					<NoSharedElements>
						<div className="flex flex-col gap-4">
							{visible.map((tweet) => (
								<TweetCard key={tweet.id} tweet={tweet} />
							))}
							{hasNextPage && (
								<div className="flex justify-center py-2">
									<Button
										variant="outline"
										loading={isFetchingNextPage}
										loadingText="加载中…"
										onClick={onLoadMore}
									>
										加载更多
									</Button>
								</div>
							)}
						</div>
					</NoSharedElements>
				)}
			</div>
		</section>
	);
}
