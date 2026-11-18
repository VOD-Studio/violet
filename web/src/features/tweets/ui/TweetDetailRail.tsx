import { formatDateTime, formatRelativeTime } from "@shared/lib/date";
import { avatarUrl } from "@shared/lib/image-url";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Avatar, Button, Card, Skeleton } from "@violet/ui";
import { tweetDetailContextOptions } from "../api/detail-context";

const formatCount = new Intl.NumberFormat("zh-CN");

/** 详情侧栏显示作者的公开推文统计，以及最近直接引用这条推文的公开记录。 */
export function TweetDetailRail({ tweetId, quoteCount }: { tweetId: string; quoteCount: number }) {
	const { data, isError, isFetching, refetch } = useQuery(tweetDetailContextOptions(tweetId));
	const author = data?.author;
	const authorName = author?.display_name.trim() || author?.username;
	const bio = author?.bio.trim();

	return (
		<aside aria-label="推文相关信息" className="flex min-w-0 flex-col gap-4">
			{isError && (
				<Card className="flex-row flex-wrap items-center justify-between">
					<p role="status" className="text-sm text-muted-foreground">
						推文相关信息加载失败
					</p>
					<Button
						variant="outline"
						size="sm"
						loading={isFetching}
						onClick={() => void refetch()}
					>
						重试
					</Button>
				</Card>
			)}
			{!data && !isError && (
				<>
					<p role="status" className="sr-only">
						正在加载推文相关信息
					</p>
					<div aria-busy="true" className="flex flex-col gap-4">
						<Skeleton className="h-48 w-full rounded-xl" />
						<Skeleton className="h-24 w-full rounded-xl" />
					</div>
				</>
			)}
			{author && (
				<Card>
					<div className="flex min-w-0 items-center gap-3">
						<Avatar
							src={author.avatar_url ? avatarUrl(author.avatar_url) : undefined}
							name={authorName}
							alt=""
							size={48}
						/>
						<div className="min-w-0 wrap-anywhere">
							<h2 className="font-semibold">{authorName}</h2>
							<p className="text-sm text-muted-foreground">@{author.username}</p>
						</div>
					</div>
					{bio && <p className="text-sm leading-relaxed wrap-anywhere">{bio}</p>}
					<div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
						<span>
							<strong className="font-medium text-foreground tabular-nums">
								{formatCount.format(author.tweet_count)}
							</strong>{" "}
							推文
						</span>
						<span>
							<strong className="font-medium text-foreground tabular-nums">
								{formatCount.format(author.received_like_count)}
							</strong>{" "}
							获赞
						</span>
					</div>
					<Button asChild variant="outline" className="w-full">
						<Link to="/users/$username" params={{ username: author.username }}>
							看主页
						</Link>
					</Button>
				</Card>
			)}
			{data && (
				<Card>
					<h2 className="text-sm font-semibold">引用了这条</h2>
					{data.quotes.length === 0 ? (
						<p className="text-sm text-muted-foreground">暂无公开引用</p>
					) : (
						<ul className="-mx-2">
							{data.quotes.map(({ id, author, content, created_at }) => {
								const name = author.display_name.trim() || author.username;
								return (
									<li key={id}>
										<Link
											to="/tweets/$id"
											params={{ id }}
											className="flex min-w-0 items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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
											<div className="min-w-0 flex-1 wrap-anywhere">
												<div className="flex flex-wrap items-baseline gap-x-2">
													<span className="font-medium">{name}</span>
													<time
														dateTime={created_at}
														title={formatDateTime(created_at, "long")}
														className="text-xs text-muted-foreground"
													>
														{formatRelativeTime(created_at)}
													</time>
												</div>
												<p className="line-clamp-2 leading-relaxed">
													{content.trim() || "引用推文"}
												</p>
											</div>
										</Link>
									</li>
								);
							})}
						</ul>
					)}
					{data.quotes.length > 0 && quoteCount > data.quotes.length && (
						<p className="text-xs text-muted-foreground">
							仅显示最近 {data.quotes.length} 条引用（共{" "}
							{formatCount.format(quoteCount)} 条）
						</p>
					)}
				</Card>
			)}
		</aside>
	);
}
