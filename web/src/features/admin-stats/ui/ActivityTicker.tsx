import { useAdminAuditLogs } from "@features/admin-audit-logs/api/queries";
import { format } from "date-fns";
import { TermPane } from "./TermPane";

/** 每条事件的滚屏驻留（ms），总时长 = 条数 × 驻留 */
const PER_ITEM_MS = 3_000;

/**
 * ActivityTicker - 自动轮播活动流。
 *
 * 终端 tail -f 形态：mono log 行（HH:mm › 摘要）在窗格内无缝上滚，
 * 内容渲染两遍实现循环。hover 暂停供细读；prefers-reduced-motion
 * 时静止。summary 为空的存量记录回退 actor + action。
 */
export function ActivityTicker() {
	const { data, isLoading } = useAdminAuditLogs({ limit: 20 });
	const events = data?.data ?? [];
	const duration = events.length * PER_ITEM_MS;

	const rows = events.map((event) => (
		<li
			key={event.event_id}
			className="flex items-baseline gap-2.5 px-4 py-1.5 font-mono text-xs"
		>
			<span className="text-muted-foreground shrink-0">
				{format(new Date(event.occurred_at), "HH:mm")}
			</span>
			<span className="text-muted-foreground shrink-0 select-none">›</span>
			<span className="truncate">
				{event.summary || `${event.actor.user_name} ${event.action} ${event.resource.type}`}
			</span>
		</li>
	));

	return (
		<TermPane
			tag="~/activity"
			title="最近活动"
			fill={false}
			trailing={
				<span className="flex items-center gap-1.5 text-xs text-emerald-500">
					<span
						className="size-1.5 animate-pulse rounded-full bg-emerald-500"
						aria-hidden
					/>
					live
				</span>
			}
		>
			{isLoading ? (
				<div className="h-40" aria-busy />
			) : rows.length === 0 ? (
				<div className="text-muted-foreground flex h-40 items-center px-4 font-mono text-xs">
					awaiting events
					<span className="animate-[caret-blink_1s_step-end_infinite]">▊</span>
				</div>
			) : (
				<div className="group relative h-40 overflow-hidden">
					<ul
						className="motion-reduce:animate-none"
						style={{
							animation: `ticker-scroll ${duration}ms linear infinite`,
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.animationPlayState = "paused";
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.animationPlayState = "running";
						}}
					>
						{rows}
						{rows}
					</ul>
					{/* 上下渐隐遮罩：滚出行在边缘淡出 */}
					<div className="from-card pointer-events-none absolute inset-x-0 top-0 h-6 bg-linear-to-b to-transparent" />
					<div className="from-card pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-linear-to-t to-transparent" />
				</div>
			)}
		</TermPane>
	);
}
