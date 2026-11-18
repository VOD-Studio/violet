import { formatRelativeTime } from "@shared/lib/date";
import { Avatar, Badge, Card } from "@violet/ui";
import type { FriendLinkPublicDTO } from "../model/types";

const FEED_LABELS: Record<FriendLinkPublicDTO["feed_status"], string> = {
	no_feed: "未提供 RSS",
	pending: "等待更新",
	ok: "RSS 正常",
	empty: "暂无文章",
	error: "RSS 抓取失败",
};

/** 展示服务端批准项和抓取快照，站点链接与最近文章是独立出口。 */
export function FriendGrid({ links }: { links: FriendLinkPublicDTO[] }) {
	return (
		<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
			{links.map((link) => (
				<Card key={link.id} className="flex min-w-0 flex-col">
					<div className="flex items-center gap-3">
						<Avatar
							src={link.avatar_url || undefined}
							name={link.name}
							alt=""
							size={48}
							imgProps={{ loading: "lazy", referrerPolicy: "no-referrer" }}
						/>
						<div className="min-w-0">
							<h2 className="font-semibold">
								<a
									href={link.url}
									target="_blank"
									rel="noopener noreferrer"
									className="rounded-sm hover:underline"
								>
									{link.name}
								</a>
							</h2>
							<p className="truncate font-mono text-xs text-muted-foreground">
								{new URL(link.url).hostname}
							</p>
						</div>
					</div>
					<p className="my-3 flex-1 text-sm leading-7">
						{link.description || "这位朋友还没有填写简介。"}
					</p>
					<div className="flex flex-wrap items-center gap-2 text-xs">
						{link.site_status === "down" ? (
							<Badge tone="warning">站点暂不可达</Badge>
						) : null}
						{link.feed_status !== "ok" ? (
							<Badge tone={link.feed_status === "error" ? "warning" : "neutral"}>
								{FEED_LABELS[link.feed_status]}
							</Badge>
						) : null}
					</div>
					{link.latest_url ? (
						<div className="mt-4 flex items-baseline gap-2 border-t border-dashed border-border pt-3 text-xs">
							<span className="shrink-0 text-muted-foreground">最近</span>
							<a
								href={link.latest_url}
								target="_blank"
								rel="noopener noreferrer"
								className="min-w-0 flex-1 truncate rounded-sm text-sm hover:underline"
								title={link.latest_title}
							>
								{link.latest_title}
							</a>
							{link.latest_published_at ? (
								<time
									dateTime={link.latest_published_at}
									title={link.latest_published_at}
									suppressHydrationWarning
									className="shrink-0 text-muted-foreground"
								>
									{formatRelativeTime(link.latest_published_at)}
								</time>
							) : (
								<span className="text-muted-foreground">日期未知</span>
							)}
						</div>
					) : null}
				</Card>
			))}
		</div>
	);
}
