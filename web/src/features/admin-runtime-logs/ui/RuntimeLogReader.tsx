import { PageShell } from "@features/admin-layout/ui/PageShell";
import { useHasPermission } from "@features/auth/hooks/usePermissions";
import { Button } from "@shared/ui/base/button";
import { Skeleton } from "@shared/ui/base/skeleton";
import Empty from "@shared/ui/empty";
import { InlineError } from "@shared/ui/inline-error";
import { OverlayScroll } from "@shared/ui/overlay-scroll";
import { ArrowUp, Download, Pause, Play, RefreshCw } from "lucide-react";
import { buildRuntimeLogExportURL } from "../api/client";
import { MAX_RUNTIME_LOG_PAGES, RUNTIME_LOG_PAGE_SIZE } from "../api/queries";
import { useRuntimeLogReader } from "../hooks/useRuntimeLogReader";
import type { RuntimeLogConnectionState } from "../hooks/useRuntimeLogStream";
import { RuntimeLogEntryRow } from "./RuntimeLogEntryRow";
import { RuntimeLogFilters } from "./RuntimeLogFilters";
import { RuntimeLogPolicyPanel } from "./RuntimeLogPolicyPanel";
import { RuntimeLogStatusPanel } from "./RuntimeLogStatusPanel";

const CONNECTION_PRESENTATION: Record<
	RuntimeLogConnectionState,
	{ label: string; dotClassName: string }
> = {
	idle: { label: "等待历史边界", dotClassName: "bg-muted-foreground" },
	connecting: { label: "正在连接", dotClassName: "animate-pulse bg-muted-foreground" },
	connected: { label: "实时已连接", dotClassName: "bg-primary" },
	reconnecting: { label: "断线恢复中", dotClassName: "animate-pulse bg-destructive" },
	revoked: { label: "权限已失效", dotClassName: "bg-destructive" },
	error: { label: "实时连接失败", dotClassName: "bg-destructive" },
};

/** 组合运行日志筛选、交付状态、保留策略与连续阅读区。 */
export function RuntimeLogReader() {
	const canManage = useHasPermission("runtimelog:manage");
	const reader = useRuntimeLogReader();
	const {
		filters,
		refreshing,
		query,
		stream,
		entries,
		historyEntries,
		atLimit,
		newerPagesEvicted,
		historyGap,
		forbidden,
		followPaused,
		newWhilePaused,
		scrollRef,
		setFollowPaused,
		handleLoadEarlier,
		handleApply,
		handleRefresh,
		resumeFollow,
	} = reader;
	const connection = CONNECTION_PRESENTATION[stream.connection];
	const streamGapDescription = stream.gap
		? stream.gap.oldest_cursor === "0"
			? `当前没有可读记录；续读检查点已移至 ${stream.gap.resume_cursor}。`
			: `最早可读游标为 ${stream.gap.oldest_cursor}，续读检查点为 ${stream.gap.resume_cursor}。`
		: "";

	return (
		<PageShell
			title="运行日志"
			description="持久化历史与实时续读使用同一筛选；数据独立于操作审计。"
			action={
				!forbidden && (
					<div className="flex flex-wrap gap-2">
						<Button asChild size="sm" variant="outline">
							<a href={buildRuntimeLogExportURL(filters)} download>
								<Download className="size-3.5" aria-hidden="true" />
								导出当前筛选
							</a>
						</Button>
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={() => void handleRefresh()}
							disabled={refreshing || query.isFetching}
						>
							<RefreshCw className="size-3.5" aria-hidden="true" />
							{refreshing ? "正在刷新…" : "刷新历史边界"}
						</Button>
					</div>
				)
			}
		>
			{forbidden ? (
				<InlineError message="服务器拒绝查看运行日志：权限不足。请联系管理员确认 runtimelog:view 授权。" />
			) : (
				<div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
					{/* 不设高度上限：多面板同开时随内容增高交给页面滚动，
					    裁切或内滚都会藏住底部面板；控制台以 min-h 保底。
					    三块面板收进同一张卡，分隔线通栏；组件内部自带 8px 内缩 */}
					<div className="min-w-0 shrink-0 overflow-hidden rounded-lg border border-edge-hairline bg-card">
						<div className="border-b border-edge-hairline px-2">
							<RuntimeLogFilters filters={filters} onApply={handleApply} />
						</div>
						<div className="border-b border-edge-hairline px-2">
							<RuntimeLogStatusPanel />
						</div>
						<div className="px-2">
							<RuntimeLogPolicyPanel canManage={canManage} />
						</div>
					</div>
					<section
						aria-label="运行日志历史与实时记录"
						className="flex min-h-80 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-edge-hairline bg-card"
					>
						<header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-edge-hairline px-3 py-3 text-xs sm:px-4">
							<div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
								<h2 className="font-medium">历史与实时</h2>
								<p
									aria-live="polite"
									className="flex items-center gap-1.5 text-muted-foreground"
								>
									<span
										className={`size-1.5 shrink-0 rounded-full ${connection.dotClassName}`}
										aria-hidden="true"
									/>
									{connection.label}
								</p>
								<p className="text-muted-foreground">接收序号正序 · 最新在底部</p>
							</div>
							<Button
								type="button"
								size="sm"
								variant={followPaused ? "default" : "outline"}
								aria-pressed={followPaused}
								onClick={() =>
									followPaused ? resumeFollow() : setFollowPaused(true)
								}
							>
								{followPaused ? (
									<Play className="size-3.5" aria-hidden="true" />
								) : (
									<Pause className="size-3.5" aria-hidden="true" />
								)}
								{followPaused
									? `继续跟随${newWhilePaused ? ` · ${newWhilePaused} 条新日志` : ""}`
									: "暂停自动跟随"}
							</Button>
							{newerPagesEvicted && (
								<p
									role="status"
									className="w-full leading-relaxed text-muted-foreground"
								>
									较新的历史页已移出 {MAX_RUNTIME_LOG_PAGES}{" "}
									页缓存；实时缓冲不受影响，刷新可回到最新历史。
								</p>
							)}
						</header>
						{(historyGap || stream.gap) && (
							<p
								role="alert"
								className="shrink-0 border-b border-edge-hairline px-4 py-3 text-xs leading-relaxed text-destructive"
							>
								保留策略已移除续读游标之前的记录，日志存在不可恢复的缺口。{" "}
								{streamGapDescription || "当前连接已从最早可用记录继续。"}
							</p>
						)}
						{stream.error && (
							<p
								role="alert"
								className="shrink-0 border-b border-edge-hairline px-4 py-3 text-xs leading-relaxed text-destructive"
							>
								{stream.error}
							</p>
						)}
						{stream.evicted > 0 && (
							<p
								role="status"
								className="shrink-0 border-b border-edge-hairline px-4 py-3 text-xs leading-relaxed text-muted-foreground"
							>
								实时缓冲固定保留最近 500 条，已有 {stream.evicted.toLocaleString()}{" "}
								条移出内存；导出或刷新历史可重新读取仍在保留期内的记录。
							</p>
						)}
						<OverlayScroll
							ref={scrollRef}
							tabIndex={0}
							role="region"
							aria-label="日志内容，可滚动阅读"
							aria-busy={query.isFetching}
							className="min-h-0 min-w-0 flex-1 focus-within:outline-ring"
						>
							{query.isPending ? (
								<div
									role="status"
									aria-label="正在加载运行日志"
									className="space-y-4 p-4"
								>
									<Skeleton className="h-16 w-full" />
									<Skeleton className="h-16 w-full" />
									<Skeleton className="h-16 w-full" />
								</div>
							) : (
								<>
									{query.isError && (
										<div className="px-4 wrap-anywhere">
											<InlineError
												message={`${query.isFetchNextPageError ? "加载更早记录失败" : "历史读取失败"}：${query.error.message}`}
												detail={
													entries.length
														? "已加载记录与实时缓冲仍保留；重试不会清空当前阅读内容。"
														: undefined
												}
												onRetry={() =>
													query.isFetchNextPageError
														? handleLoadEarlier()
														: void query.refetch()
												}
												retrying={query.isFetching}
											/>
										</div>
									)}
									{entries.length > 0 ? (
										<ol className="min-w-0 divide-y divide-edge-hairline">
											{entries.map((entry) => (
												<RuntimeLogEntryRow key={entry.id} entry={entry} />
											))}
										</ol>
									) : !query.isError ? (
										<Empty
											size="sm"
											title="没有符合条件的运行日志"
											description="实时连接仍会等待符合当前筛选的新记录。可重置筛选、扩大时间范围或检查采集状态。"
											className="px-4 py-10"
										/>
									) : null}
								</>
							)}
						</OverlayScroll>
						<footer className="shrink-0 space-y-2 border-t border-edge-hairline px-3 py-3 sm:px-4">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<p aria-live="polite" className="text-xs text-muted-foreground">
									当前窗口 {entries.length.toLocaleString()} 条 · 历史{" "}
									{historyEntries.length.toLocaleString()} 条 · 实时{" "}
									{stream.entries.length.toLocaleString()} 条
								</p>
								<Button
									type="button"
									size="sm"
									variant="outline"
									onClick={handleLoadEarlier}
									disabled={!query.hasNextPage || query.isFetching || refreshing}
								>
									<ArrowUp className="size-3.5" aria-hidden="true" />
									{query.isFetchingNextPage ? "正在加载…" : "加载更早记录"}
								</Button>
							</div>
							<p className="text-xs leading-relaxed text-muted-foreground">
								{query.isSuccess && !query.hasNextPage && historyEntries.length > 0
									? "已到当前筛选条件下可读取的最早记录。"
									: atLimit
										? `历史缓存已满 ${MAX_RUNTIME_LOG_PAGES} 页，继续加载会移出较新历史；实时缓冲独立限制为 500 条。`
										: `历史每页最多 ${RUNTIME_LOG_PAGE_SIZE} 条、最多保留 ${MAX_RUNTIME_LOG_PAGES} 页；计数不代表全部日志总数。`}
							</p>
						</footer>
					</section>
				</div>
			)}
		</PageShell>
	);
}
