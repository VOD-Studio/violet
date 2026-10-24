import type { RuntimePolicyView } from "@entities/runtime-policy/model/types";
import { PageShell } from "@features/admin-layout/ui/PageShell";
import type { RuntimePolicyForm } from "@features/admin-settings/hooks/use-runtime-policy-form";
import { PolicyHelp, RuntimeFieldContext } from "@features/admin-settings/ui/runtime-policy-fields";
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@violet/ui";
import { type ReactNode, useId } from "react";

interface RuntimePolicyPageProps<T extends object> {
	title: string;
	form: RuntimePolicyForm<T>;
	children: ReactNode;
	status?: ReactNode;
	fields?: (values: T) => Record<string, unknown>;
}

/** 四组策略共用保存、冲突与实例状态展示，不负责渲染业务字段。 */
export function RuntimePolicyPage<T extends object>({
	title,
	form,
	children,
	fields,
	status,
}: RuntimePolicyPageProps<T>) {
	const id = useId();
	const { query, baseline, draft, mutation } = form;
	if (!baseline || !draft)
		return (
			<PageShell title={title}>
				{query.isError ? (
					<div role="alert" className="space-y-3">
						<p>策略加载失败：{query.error.message}</p>
						<Button onClick={() => void query.refetch()} disabled={query.isFetching}>
							重试
						</Button>
					</div>
				) : (
					<p role="status">加载中…</p>
				)}
			</PageShell>
		);
	const latest: RuntimePolicyView<T> =
		query.data && query.data.version >= baseline.version ? query.data : baseline;
	const conflict = form.conflict;
	const newer = latest.version !== baseline.version;
	const runtime = latest.runtime;
	const disabled = !form.canUpdate || mutation.isPending;
	const sources = latest.sources;
	const saved: Record<string, unknown> = fields
		? fields(latest.values)
		: Object.fromEntries(Object.entries(latest.values));
	const effective: Record<string, unknown> = fields
		? fields(runtime.values)
		: Object.fromEntries(Object.entries(runtime.values));
	return (
		<PageShell
			title={title}
			action={
				form.canUpdate && (
					<Button
						size="sm"
						type="submit"
						form={id}
						disabled={!form.dirty || mutation.isPending || conflict}
					>
						{mutation.isPending ? "保存中…" : "保存设置"}
					</Button>
				)
			}
		>
			<form
				id={id}
				className="space-y-6"
				onSubmit={(event) => {
					event.preventDefault();
					void form.submit();
				}}
			>
				<section
					className="space-y-3 rounded-xl border border-border p-4"
					aria-label="策略状态"
				>
					<div className="flex flex-wrap items-center gap-3 text-sm">
						<span>{form.canUpdate ? "可编辑" : "只读"}</span>
						<span>{form.dirty ? "有未保存修改" : "无未保存修改"}</span>
						<span>保存版本：{latest.version}</span>
						<span>草稿基准：{baseline.version}</span>
						<span>实例应用版本：{runtime.version}</span>
						<span>
							状态：
							{query.isError
								? "读取失败"
								: runtime.status === "applied"
									? "已应用"
									: runtime.status === "stale"
										? "读取过期"
										: "应用失败"}
						</span>
						<PolicyHelp label="实例状态">
							状态仅代表本次请求所在实例，不代表所有实例已同步；跨实例每两秒刷新。保存成功不保证运行器依赖可用。
						</PolicyHelp>
					</div>
					<div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
						<span>实例：{runtime.instance_id}</span>
						<span>应用时间：{runtime.applied_at || "—"}</span>
						<span>检查时间：{runtime.last_checked_at || "—"}</span>
						<span>
							生效时机：
							{runtime.activation === "new_requests"
								? "后续请求"
								: runtime.activation === "new_tasks"
									? "后续任务"
									: "浏览器刷新策略后的后续调度"}
						</span>
					</div>
					{runtime.error && (
						<p role="alert" className="text-sm text-destructive-text">
							{runtime.error}
						</p>
					)}
					{form.notice && (
						<p role="status" className="text-sm">
							{form.notice}
						</p>
					)}
					{query.isError && (
						<p role="alert" className="text-sm text-destructive-text">
							读取失败：{query.error.message}
						</p>
					)}
					{(conflict || newer) && (
						<p role="alert" className="text-sm text-destructive-text">
							服务器配置已变化，草稿已保留。请重新加载后再编辑保存。
						</p>
					)}
					{mutation.error && !conflict && (
						<p role="alert" className="text-sm text-destructive-text">
							保存失败：{mutation.error.message}
						</p>
					)}
					{form.reloadError && (
						<p role="alert" className="text-sm text-destructive-text">
							{form.reloadError}
						</p>
					)}
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={query.isFetching || mutation.isPending}
						onClick={() => void form.reload()}
					>
						重新加载
					</Button>
				</section>
				{status}
				<div className="flex flex-wrap items-center gap-3">
					<label htmlFor={`${id}-preset`} className="text-sm font-medium">
						场景预设
					</label>
					<Select value={form.selection} onValueChange={form.preset} disabled={disabled}>
						<SelectTrigger id={`${id}-preset`} className="w-48">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="custom" disabled>
								自定义
							</SelectItem>
							<SelectItem value="defaults" disabled>
								默认值草稿
							</SelectItem>
							{(baseline.presets ?? []).map((preset) => (
								<SelectItem key={preset.id} value={preset.id}>
									{preset.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<PolicyHelp label="场景预设">
						选择只改变当前草稿，点击保存才生效。
						{(baseline.presets ?? []).map((preset) => (
							<span key={preset.id} className="block">
								{preset.label}：{preset.description}
							</span>
						))}
					</PolicyHelp>
					<Button
						type="button"
						variant="outline"
						disabled={disabled}
						onClick={form.resetDefaults}
					>
						恢复默认
					</Button>
				</div>
				<RuntimeFieldContext
					value={{ disabled, sources, saved, effective, error: form.fieldError }}
				>
					<details className="space-y-4 rounded-xl border border-border p-4">
						<summary className="cursor-pointer text-sm font-medium">高级参数</summary>
						<div className="space-y-6 pt-2">{children}</div>
					</details>
				</RuntimeFieldContext>
			</form>
		</PageShell>
	);
}
