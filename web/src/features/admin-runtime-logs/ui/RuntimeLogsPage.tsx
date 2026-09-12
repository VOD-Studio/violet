import { PageShell } from "@features/admin-layout/ui/PageShell";
import { useMe } from "@features/auth/api/queries";
import { useHasPermission } from "@features/auth/hooks/usePermissions";
import { Skeleton } from "@shared/ui/base/skeleton";
import { InlineError } from "@shared/ui/inline-error";
import { RuntimeLogReader } from "./RuntimeLogReader";

/** 权限解析完成前不挂载历史、实时连接或策略查询。 */
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
