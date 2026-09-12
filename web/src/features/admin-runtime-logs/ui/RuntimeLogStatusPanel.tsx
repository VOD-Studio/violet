import { ApiError } from "@shared/api/error";
import { formatDateTime } from "@shared/lib/date";
import { Skeleton } from "@shared/ui/base/skeleton";
import { InlineError } from "@shared/ui/inline-error";
import { useRuntimeLogStatus } from "../api/queries";

/** 展示当前进程采集状态，采集故障不阻止阅读已持久化的历史。 */
export function RuntimeLogStatusPanel() {
	const query = useRuntimeLogStatus();
	if (query.isPending) {
		return (
			<div role="status" aria-label="正在加载采集状态" className="py-3">
				<Skeleton className="h-5 w-56 max-w-full" />
			</div>
		);
	}
	if (query.error instanceof ApiError && query.error.status === 403) {
		return <InlineError message="没有查看运行日志采集状态的权限。" />;
	}
	if (!query.data) {
		return (
			<InlineError
				message={`采集状态读取失败：${query.error?.message ?? "未收到状态数据"}`}
				onRetry={() => void query.refetch()}
				retrying={query.isFetching}
			/>
		);
	}

	const status = query.data;
	const stateLabel = status.initialization_failed
		? "初始化失败"
		: status.enabled
			? "采集已启用"
			: "采集未启用";
	const counters = [
		["已接收", status.accepted],
		["已持久化", status.persisted],
		["队列溢出丢弃", status.queue_overflow],
		["持久化失败丢弃", status.persistence_failed],
		["停机丢弃", status.shutdown_dropped],
		["格式无效丢弃", status.malformed],
		["超限丢弃", status.oversized],
	] as const;

	return (
		<div className="min-w-0">
			<details>
				<summary className="cursor-pointer rounded-sm py-3 text-sm focus-visible:outline-2 focus-visible:outline-ring">
					<span
						className={
							status.initialization_failed || status.persistence_failed > 0
								? "font-medium text-destructive"
								: "font-medium"
						}
					>
						{stateLabel}
					</span>
					<span className="ml-2 text-xs text-muted-foreground">
						zerolog 下限 {status.minimum_level.toUpperCase()} · 队列 {status.queued} /{" "}
						{status.capacity}
					</span>
				</summary>
				<div className="space-y-3 pb-4 text-xs">
					<p className="leading-relaxed text-muted-foreground">
						zerolog 在源端按此下限输出；标准库日志按 INFO 收录。选择 TRACE
						不会恢复源端未输出的记录。 计数属于当前进程，不是筛选结果总数；状态每 15
						秒更新。
					</p>
					<dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4 xl:grid-cols-7">
						{counters.map(([label, value]) => (
							<div key={label} className="min-w-0 space-y-1">
								<dt className="text-muted-foreground">{label}</dt>
								<dd className="font-mono tabular-nums">{value.toLocaleString()}</dd>
							</div>
						))}
					</dl>
					<p className="text-muted-foreground">
						观测时间：
						<time dateTime={status.observed_at} title={status.observed_at}>
							{formatDateTime(status.observed_at, "second")}
						</time>
					</p>
					{status.last_failure && (
						<p className="text-destructive">
							最近持久化失败时间：
							<time dateTime={status.last_failure} title={status.last_failure}>
								{formatDateTime(status.last_failure, "second")}
							</time>
						</p>
					)}
				</div>
			</details>
			{status.initialization_failed && (
				<p role="alert" className="pb-3 text-xs text-destructive">
					采集器初始化失败，当前进程无法写入新日志。请检查服务端运行日志配置；已有历史仍可读取。
				</p>
			)}
			{!status.enabled && !status.initialization_failed && (
				<p className="pb-3 text-xs text-muted-foreground">
					运行日志采集未启用，本页仅可读取已有历史。
				</p>
			)}
			{status.persistence_failed > 0 && (
				<p role="alert" className="pb-3 text-xs text-destructive">
					当前进程累计有 {status.persistence_failed.toLocaleString()}{" "}
					条日志因持久化失败丢弃，历史可能不完整。展开采集状态查看最近失败时间。
				</p>
			)}
			{query.isError && (
				<InlineError
					message={`采集状态更新失败，以上为上次成功观测：${query.error.message}`}
					onRetry={() => void query.refetch()}
					retrying={query.isFetching}
				/>
			)}
		</div>
	);
}
