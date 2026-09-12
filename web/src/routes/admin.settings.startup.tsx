import { PageShell } from "@features/admin-layout/ui/PageShell";
import { useStartupSettings } from "@features/admin-settings/api/queries";
import { useHasPermission } from "@features/auth/hooks/usePermissions";
import { Button } from "@shared/ui/base/button";
import { Skeleton } from "@shared/ui/base/skeleton";
import { InlineError } from "@shared/ui/inline-error";
import { createFileRoute } from "@tanstack/react-router";

function StartupSettingsPage() {
	const canView = useHasPermission("settings:view");
	const query = useStartupSettings();
	return (
		<PageShell
			title="启动配置"
			description="当前进程的只读启动快照。修改部署配置后需重启；本页不提供在线保存。"
			action={
				canView ? (
					<Button
						size="sm"
						variant="outline"
						disabled={query.isFetching}
						onClick={() => query.refetch()}
					>
						刷新快照
					</Button>
				) : undefined
			}
		>
			{!canView ? (
				<p role="alert">没有查看设置的权限。</p>
			) : query.isPending ? (
				<div role="status" aria-label="正在加载启动快照">
					<Skeleton className="h-40 w-full" />
				</div>
			) : query.isError ? (
				<InlineError
					message={`加载启动快照失败：${query.error.message}`}
					onRetry={() => query.refetch()}
					retryLabel="重试加载"
					retrying={query.isFetching}
				/>
			) : (
				<div className="flex flex-col gap-6">
					<p className="text-sm text-muted-foreground">
						观测时间：
						<time dateTime={query.data.observed_at}>{query.data.observed_at}</time> ·
						敏感字段仅显示配置状态
					</p>
					{query.data.sections.length === 0 && <p>当前快照没有可展示的启动配置。</p>}
					{query.data.sections.map((section) => (
						<section key={section.id} className="flex min-w-0 flex-col gap-4">
							<h2 className="text-base font-semibold">{section.label}</h2>
							<dl className="divide-y divide-edge-hairline rounded-lg border border-edge-hairline px-4">
								{section.fields.map((field) => (
									<div
										key={field.key}
										className="grid gap-2 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]"
									>
										<dt className="min-w-0 wrap-break-word">{field.label}</dt>
										<dd className="min-w-0 whitespace-pre-wrap break-all tabular-nums">
											{field.sensitive
												? field.value === true
													? "已设置"
													: "未设置"
												: field.value === null
													? "—"
													: typeof field.value === "boolean"
														? field.value
															? "是"
															: "否"
														: String(field.value)}
										</dd>
										<dd className="text-muted-foreground">
											{
												{
													environment: "环境变量",
													default: "部署默认",
													runtime: "运行时观测",
												}[field.source]
											}
										</dd>
									</div>
								))}
							</dl>
						</section>
					))}
				</div>
			)}
		</PageShell>
	);
}

export const Route = createFileRoute("/admin/settings/startup")({ component: StartupSettingsPage });
