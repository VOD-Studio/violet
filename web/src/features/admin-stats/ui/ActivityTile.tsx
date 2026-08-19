import { useAdminAuditLogs } from "@features/admin-audit-logs/api/queries";
import { Card, CardContent } from "@shared/ui/base/card";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { History } from "lucide-react";

/**
 * 最近活动流卡：站长视角的「刚刚发生了什么」。
 *
 * 数据源为 audit 事件流（复用 admin-audit-logs 的列表 hook，limit 5），
 * 展示人话摘要 + 相对时间；summary 为空的存量旧记录回退 actor + action。
 */
export function ActivityTile() {
	const { data, isLoading } = useAdminAuditLogs({ limit: 5 });
	const events = data?.data ?? [];

	return (
		<Card className="border-border/60 h-full">
			<CardContent className="flex h-full flex-col gap-3 p-6">
				<div className="flex items-center justify-between">
					<span className="text-sm font-medium">最近活动</span>
					<History className="text-muted-foreground size-4" />
				</div>
				{isLoading ? (
					<div className="h-24" aria-busy />
				) : events.length === 0 ? (
					<div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
						暂无活动记录
					</div>
				) : (
					<ul className="flex flex-col">
						{events.map((event) => (
							<li
								key={event.event_id}
								className="border-border/60 flex items-center justify-between gap-3 border-b py-2 first:pt-0 last:border-b-0 last:pb-0"
							>
								<span className="truncate text-sm">
									{event.summary ||
										`${event.actor.user_name} ${event.action} ${event.resource.type}`}
								</span>
								<span className="text-muted-foreground shrink-0 text-xs">
									{formatDistanceToNow(new Date(event.occurred_at), {
										addSuffix: true,
										locale: zhCN,
									})}
								</span>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
