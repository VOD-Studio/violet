import { PageShell } from "@features/admin-layout/ui/PageShell";
import { useMe } from "@features/auth/api/queries";
import { useHasPermission } from "@features/auth/hooks/usePermissions";
import { ApiError } from "@shared/api/error";
import { Button } from "@shared/ui/base/button";
import { Skeleton } from "@shared/ui/base/skeleton";
import Empty from "@shared/ui/empty";
import { InlineError } from "@shared/ui/inline-error";
import { OverlayScroll } from "@shared/ui/overlay-scroll";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, RefreshCw } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { runtimeLogKeys } from "../api/keys";
import { MAX_RUNTIME_LOG_PAGES, RUNTIME_LOG_PAGE_SIZE, useRuntimeLogs } from "../api/queries";
import type { RuntimeLogFilter } from "../model/types";
import { RuntimeLogEntryRow } from "./RuntimeLogEntryRow";
import { RuntimeLogFilters } from "./RuntimeLogFilters";
import { RuntimeLogStatusPanel } from "./RuntimeLogStatusPanel";

/** 权限解析完成前不挂载历史或状态查询，深链与菜单遵循同一权限。 */
export function RuntimeLogsPage() {
	const me = useMe();
	const canView = useHasPermission("runtimelog:view");
	if (canView) return <RuntimeLogReader />;
	return (
		<PageShell title="运行日志" description="服务运行历史，与操作审计独立保存。">
			{me.isPending ? (
				<div role="status" aria-label="正在确认运行日志查看权限">
					<Skeleton className="h-32 w-full" />
				</div>
			) : me.isError ? (
				<InlineError
					message={`无法确认查看权限：${me.error.message}`}
					onRetry={() => void me.refetch()}
					retrying={me.isFetching}
				/>
			) : (
				<p role="alert" className="text-sm">
					没有查看运行日志的权限，需要 runtimelog:view。请联系管理员授权。
				</p>
			)}
		</PageShell>
	);
}

function RuntimeLogReader() {
	const [filters, setFilters] = useState<RuntimeLogFilter>({});
	const [refreshing, setRefreshing] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);
	const scrollAnchorRef = useRef<{ id: string; offset: number } | null>(null);
	const queryClient = useQueryClient();
	const query = useRuntimeLogs(filters);
	const pages = query.data?.pages ?? [];
	const historyWindowKey = pages.map((page) => page.items[0]?.id ?? "").join(":");
	const entries = pages.flatMap((page) => page.items);
	const atLimit = pages.length >= MAX_RUNTIME_LOG_PAGES;
	const newerPagesEvicted = Boolean(query.data?.pageParams[0]);
	const gap = pages.some((page) => page.gap);
	const forbidden = query.error instanceof ApiError && query.error.status === 403;

	useLayoutEffect(() => {
		const container = scrollRef.current;
		const anchor = scrollAnchorRef.current;
		if (!container || !anchor || !historyWindowKey || query.isFetchingNextPage) return;
		const row = container.querySelector<HTMLElement>(
			`[data-runtime-log-id="${CSS.escape(anchor.id)}"]`,
		);
		container.scrollTop = row
			? container.scrollTop +
				row.getBoundingClientRect().top -
				container.getBoundingClientRect().top -
				anchor.offset
			: 0;
		scrollAnchorRef.current = null;
	}, [historyWindowKey, query.isFetchingNextPage]);

	function handleLoadEarlier() {
		const container = scrollRef.current;
		if (atLimit && container) {
			const top = container.getBoundingClientRect().top;
			const row = Array.from(
				container.querySelectorAll<HTMLElement>("[data-runtime-log-id]"),
			).find((element) => element.getBoundingClientRect().bottom > top);
			const id = row?.dataset.runtimeLogId;
			if (row && id)
				scrollAnchorRef.current = { id, offset: row.getBoundingClientRect().top - top };
		}
		void query.fetchNextPage();
	}

	function handleApply(next: RuntimeLogFilter) {
		scrollAnchorRef.current = null;
		setFilters(next);
		// 回到某个已访问条件时也从首屏开始，而不是复用该条件的旧历史窗口。
		void queryClient.resetQueries({ queryKey: runtimeLogKeys.list(next), exact: true });
		scrollRef.current?.scrollTo({ top: 0 });
	}

	async function handleRefresh() {
		scrollAnchorRef.current = null;
		setRefreshing(true);
		try {
			const target = { queryKey: runtimeLogKeys.list(filters), exact: true };
			await queryClient.cancelQueries(target);
			scrollRef.current?.scrollTo({ top: 0 });
			await Promise.all([
				queryClient.resetQueries(target),
				queryClient.invalidateQueries({ queryKey: runtimeLogKeys.status(), exact: true }),
			]);
		} finally {
			setRefreshing(false);
		}
	}

	return (
		<PageShell
			title="运行日志"
			description="已采集的服务运行历史，与操作审计独立保存。"
			action={
				!forbidden && (
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={() => void handleRefresh()}
						disabled={refreshing || query.isFetching}
					>
						<RefreshCw className="size-3.5" aria-hidden="true" />
						{refreshing ? "正在刷新…" : "刷新最近历史"}
					</Button>
				)
			}
		>
			{forbidden ? (
				<InlineError message="服务器拒绝查看运行日志：权限不足。请联系管理员确认 runtimelog:view 授权。" />
			) : (
				<div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
					<div className="max-h-[45%] min-h-0 shrink-0 overflow-y-auto overscroll-contain">
						<RuntimeLogFilters filters={filters} onApply={handleApply} />
						<RuntimeLogStatusPanel />
					</div>
					<section
						aria-label="运行日志历史"
						className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-edge-hairline bg-card"
					>
						<header className="flex shrink-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-edge-hairline px-3 py-3 text-xs sm:px-4">
							<h2 className="font-medium">历史记录</h2>
							<p className="text-muted-foreground">
								接收序号倒序 · 发生时间按设备时区显示
							</p>
							{newerPagesEvicted && (
								<p
									role="status"
									className="w-full leading-relaxed text-muted-foreground"
								>
									较新的记录已移出 {MAX_RUNTIME_LOG_PAGES}{" "}
									页缓存；可继续加载更早记录，刷新可返回最近历史。
								</p>
							)}
						</header>
						<OverlayScroll
							ref={scrollRef}
							tabIndex={0}
							role="region"
							aria-label="日志内容，可滚动阅读"
							aria-busy={query.isFetching}
							className="min-h-0 min-w-0 flex-1 focus-within:outline-ring"
						>
							{gap && (
								<p
									role="alert"
									className="border-b border-edge-hairline px-4 py-3 text-xs leading-relaxed text-destructive"
								>
									历史游标已超出当前保留范围，记录存在缺口。请刷新最近历史或调整时间范围；本页不能补回已丢失的日志。
								</p>
							)}
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
														? "已加载记录仍保留；重试不会清空当前阅读内容。"
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
											description="可重置筛选、扩大时间范围或检查采集状态。源端未输出、尚未持久化或已丢弃的记录不会出现在这里。"
											className="px-4 py-10"
										/>
									) : null}
								</>
							)}
						</OverlayScroll>
						<footer className="shrink-0 space-y-2 border-t border-edge-hairline px-3 py-3 sm:px-4">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<p aria-live="polite" className="text-xs text-muted-foreground">
									当前已加载 {entries.length.toLocaleString()} 条 · {pages.length}{" "}
									/ {MAX_RUNTIME_LOG_PAGES} 页
								</p>
								<Button
									type="button"
									size="sm"
									variant="outline"
									onClick={handleLoadEarlier}
									disabled={!query.hasNextPage || query.isFetching || refreshing}
								>
									<ArrowDown className="size-3.5" aria-hidden="true" />
									{query.isFetchingNextPage ? "正在加载…" : "加载更早记录"}
								</Button>
							</div>
							<p className="text-xs leading-relaxed text-muted-foreground">
								{query.isSuccess && !query.hasNextPage && entries.length > 0
									? "已到当前筛选条件下可读取的最早记录。"
									: atLimit
										? `当前缓存已满 ${MAX_RUNTIME_LOG_PAGES} 页，继续加载将移出较新的记录；缓存条数不代表日志总数。`
										: `每页最多 ${RUNTIME_LOG_PAGE_SIZE} 条，当前窗口最多保留 ${MAX_RUNTIME_LOG_PAGES} 页；已加载数不代表全部日志总数。`}
							</p>
						</footer>
					</section>
				</div>
			)}
		</PageShell>
	);
}
