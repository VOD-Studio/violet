import { contentImageUrl } from "@shared/lib/image-url";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Images } from "lucide-react";
import { Skeleton } from "@/shared/ui/base/skeleton";
import { useUserGalleries } from "../api/queries";

/** 个人主页量级一次拉满（对齐 userTimelineOf 的 limit 惯例） */
const USER_PAGE_SIZE = 50;

/** 用户主页的图集卡片网格（封面/标题/项数/相对时间，点击进详情），一次拉取个人主页量级。 */
export function UserGalleryGrid({ username }: { username: string }) {
	const { data, isLoading, isError } = useUserGalleries(username, {
		page: 1,
		limit: USER_PAGE_SIZE,
	});
	const items = data?.data ?? [];

	if (isLoading) {
		return (
			<div className="grid gap-4 sm:grid-cols-2">
				{Array.from({ length: 4 }, (_, i) => (
					<Skeleton key={i} className="aspect-16/10 w-full rounded-2xl" />
				))}
			</div>
		);
	}

	if (isError) {
		return (
			<div className="rounded-2xl border border-edge-hairline/60 p-8 text-center text-sm text-muted-foreground">
				图集加载失败，请稍后重试
			</div>
		);
	}

	if (items.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-edge-hairline/60 p-10 text-center text-muted-foreground">
				<Images className="size-8" />
				<p className="text-sm">该用户还没有公开图集</p>
			</div>
		);
	}

	return (
		<div className="grid gap-4 sm:grid-cols-2">
			{items.map((g) => (
				<Link
					key={g.id}
					to="/galleries/$id"
					params={{ id: g.id }}
					className="group block overflow-hidden rounded-2xl border border-edge-hairline/60 bg-card/40 transition-colors hover:border-primary/40"
				>
					<div className="aspect-16/10 bg-muted">
						{g.cover_url ? (
							<img
								src={contentImageUrl(g.cover_url, { width: 480 })}
								alt={g.title}
								loading="lazy"
								className="size-full object-cover transition-transform duration-300 group-hover:scale-102"
							/>
						) : (
							<div className="flex size-full items-center justify-center text-muted-foreground">
								<Images className="size-8" />
							</div>
						)}
					</div>
					<div className="p-3">
						<h3 className="line-clamp-1 text-sm font-medium transition-colors group-hover:text-primary">
							{g.title}
						</h3>
						<p className="mt-1 font-mono text-xs text-muted-foreground">
							{g.item_count} 项 ·{" "}
							{formatDistanceToNow(new Date(g.created_at), {
								addSuffix: true,
								locale: zhCN,
							})}
						</p>
					</div>
				</Link>
			))}
		</div>
	);
}

export default UserGalleryGrid;
