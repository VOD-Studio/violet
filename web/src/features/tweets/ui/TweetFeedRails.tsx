import { useTweetSidebar } from "@features/tweets/api/queries";
import { avatarUrl, contentImageUrl } from "@shared/lib/image-url";
import { Link } from "@tanstack/react-router";
import { Avatar, Button, Card, Skeleton } from "@violet/ui";

export const TWEET_DISCOVERY_ID = "tweet-discovery";

const railRowClass =
	"flex min-w-0 items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted";

/** 发现侧栏使用独立的全站统计，不随当前筛选或分页变动。 */
export function TweetFeedRails() {
	const { data, isError, isFetching, refetch } = useTweetSidebar();
	return (
		<aside
			id={TWEET_DISCOVERY_ID}
			aria-labelledby={`${TWEET_DISCOVERY_ID}-heading`}
			tabIndex={-1}
			className="flex min-w-0 scroll-mt-24 flex-col gap-5 lg:sticky lg:top-24"
		>
			<h2 id={`${TWEET_DISCOVERY_ID}-heading`} className="sr-only">
				发现推文
			</h2>
			{isError && (
				<Card className="flex flex-wrap items-center justify-between gap-2">
					<p role="status" className="text-sm text-muted-foreground">
						发现内容加载失败
					</p>
					<Button
						variant="outline"
						size="sm"
						loading={isFetching}
						onClick={() => void refetch()}
					>
						重试发现内容
					</Button>
				</Card>
			)}
			{!data && !isError && (
				<div
					role="status"
					aria-label="正在加载发现内容"
					aria-busy="true"
					className="flex flex-col gap-5"
				>
					{["authors", "topics", "images"].map((slot) => (
						<Skeleton key={slot} className="h-36 w-full rounded-2xl" />
					))}
				</div>
			)}
			{data && (
				<>
					<Card>
						<h3 className="mb-2 text-sm font-medium text-muted-foreground">活跃作者</h3>
						{data.authors.length > 0 ? (
							<ul className="-mx-2">
								{data.authors.map((author) => {
									const name = author.display_name || author.username;
									return (
										<li key={author.id}>
											<Link
												to="/users/$username"
												params={{ username: author.username }}
												aria-label={`${name} ${author.count} 条`}
												className={railRowClass}
											>
												<Avatar
													src={
														author.avatar_url
															? avatarUrl(author.avatar_url)
															: undefined
													}
													name={name}
													alt=""
													size={32}
													imgProps={{ loading: "lazy" }}
												/>
												<span className="min-w-0 flex-1 truncate">
													{name}
												</span>
												<span className="shrink-0 text-xs text-muted-foreground tabular-nums">
													{author.count} 条
												</span>
											</Link>
										</li>
									);
								})}
							</ul>
						) : (
							<p className="text-sm text-muted-foreground">最近 30 天暂无活跃作者</p>
						)}
					</Card>
					<Card>
						<h3 className="mb-2 text-sm font-medium text-muted-foreground">话题</h3>
						{data.topics.length > 0 ? (
							<ul className="-mx-2">
								{data.topics.map(({ tag, count }) => (
									<li key={tag}>
										<Link
											to="/tweets/topics/$tag"
											params={{ tag }}
											aria-label={`#${tag} ${count} 条`}
											className={railRowClass}
										>
											<span className="min-w-0 truncate">#{tag}</span>
											<span className="shrink-0 text-xs text-muted-foreground tabular-nums">
												{count} 条
											</span>
										</Link>
									</li>
								))}
							</ul>
						) : (
							<p className="text-sm text-muted-foreground">最近 30 天暂无话题</p>
						)}
					</Card>
					<Card>
						<h3 className="mb-3 text-sm font-medium text-muted-foreground">
							最近的图片
						</h3>
						{data.images.length > 0 ? (
							<ul className="grid grid-cols-3 gap-1">
								{data.images.map((photo) => (
									<li key={`${photo.tweet_id}:${photo.index}`}>
										<Link
											to="/tweets/$id"
											params={{ id: photo.tweet_id }}
											search={
												photo.index === 0 ? {} : { image: photo.index + 1 }
											}
											aria-label={`查看第 ${photo.index + 1} 张图片所在的推文`}
											className="block aspect-square rounded-lg bg-muted transition-opacity hover:opacity-80"
										>
											<img
												src={contentImageUrl(photo.url, { width: 320 })}
												alt=""
												width={photo.width ?? undefined}
												height={photo.height ?? undefined}
												loading="lazy"
												className="size-full rounded-[inherit] object-cover"
											/>
										</Link>
									</li>
								))}
							</ul>
						) : (
							<p className="text-sm text-muted-foreground">还没有图片</p>
						)}
					</Card>
				</>
			)}
		</aside>
	);
}
