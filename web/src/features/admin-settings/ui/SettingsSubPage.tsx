import { PageShell } from "@features/admin-layout/ui/PageShell";
import { ApiError } from "@shared/api/error";
import { Button } from "@shared/ui/base/button";
import { Skeleton } from "@shared/ui/base/skeleton";
import { ConfirmDialog } from "@shared/ui/confirm-dialog";
import { InlineError } from "@shared/ui/inline-error";
import { type FormEventHandler, type ReactNode, useId, useState } from "react";
import type { SettingsMeta } from "../model/types";
import { SettingsFieldContext } from "./settings-fields";

/** 设置页的查询、编辑与版本状态。 */
export interface SettingsPageState {
	isLoading: boolean;
	isPending: boolean;
	isDirty: boolean;
	canView: boolean;
	canWrite: boolean;
	meta?: SettingsMeta;
	queryError: Error | null;
	error: Error | null;
	errors: Record<string, unknown>;
	onSubmit: FormEventHandler<HTMLFormElement>;
	onReload: () => Promise<void>;
	onReset: () => Promise<void>;
}

interface SettingsSubPageProps {
	title: string;
	description: string;
	state: SettingsPageState;
	children: ReactNode;
}

const EFFECT_LABELS = { new_request: "新请求生效", new_task: "新任务生效", restart: "需重启生效" };
const STATUS_LABELS = {
	applied: "已应用",
	pending_restart: "等待重启",
	failed: "应用失败，仍使用原有效版本",
};

/** 设置子页外壳：版本状态、保存与恢复动作，以及只读权限边界。 */
export function SettingsSubPage({ title, description, state, children }: SettingsSubPageProps) {
	const formId = useId();
	const [resetOpen, setResetOpen] = useState(false);
	const { meta, error, queryError, isPending } = state;
	const conflict = error instanceof ApiError && error.status === 409;
	return (
		<PageShell
			title={title}
			description={description}
			action={
				state.canWrite && meta ? (
					<Button
						type="submit"
						form={formId}
						size="sm"
						disabled={isPending || !state.isDirty}
					>
						{isPending ? "处理中…" : "保存设置"}
					</Button>
				) : undefined
			}
		>
			{!state.canView ? (
				<p role="alert">没有查看设置的权限。</p>
			) : state.isLoading ? (
				<div className="flex flex-col gap-4" role="status" aria-label="正在加载设置">
					<Skeleton className="h-20 w-full" />
					<Skeleton className="h-10 w-full" />
				</div>
			) : (
				<div className="flex flex-col gap-6">
					{queryError && (
						<InlineError
							message={`加载设置失败：${queryError.message}`}
							onRetry={state.onReload}
							retryLabel="重试加载"
							retrying={isPending}
						/>
					)}
					{meta && (
						<>
							<section
								aria-label="配置生效状态"
								className="flex flex-col gap-3 rounded-lg border border-edge-hairline p-4"
							>
								<dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
									<div>
										<dt className="text-muted-foreground">已保存版本</dt>
										<dd className="tabular-nums">{meta.saved_version}</dd>
									</div>
									<div>
										<dt className="text-muted-foreground">当前应用版本</dt>
										<dd className="tabular-nums">{meta.applied_version}</dd>
									</div>
									<div>
										<dt className="text-muted-foreground">生效时机</dt>
										<dd>{EFFECT_LABELS[meta.effect]}</dd>
									</div>
								</dl>
								<p role="status" className="text-sm">
									{STATUS_LABELS[meta.status]}
									{state.isDirty ? " · 有未保存修改" : ""}
								</p>
								{meta.error && (
									<p role="alert" className="text-sm text-destructive">
										{meta.error}
									</p>
								)}
								<details className="text-sm">
									<summary className="cursor-pointer">查看字段来源</summary>
									<dl className="mt-3 grid gap-2">
										{Object.entries(meta.sources).map(([key, source]) => (
											<div
												key={key}
												className="flex flex-wrap justify-between gap-2"
											>
												<dt className="break-all">{key}</dt>
												<dd className="text-muted-foreground">
													{source === "database"
														? "数据库覆盖"
														: "部署默认"}
												</dd>
											</div>
										))}
									</dl>
								</details>
								<div className="flex flex-wrap gap-2">
									<Button
										type="button"
										size="sm"
										variant="outline"
										disabled={isPending}
										onClick={state.onReload}
									>
										重新加载
									</Button>
									{state.canWrite && (
										<Button
											type="button"
											size="sm"
											variant="outline"
											disabled={isPending}
											onClick={() => setResetOpen(true)}
										>
											恢复部署默认
										</Button>
									)}
								</div>
							</section>
							{error && (
								<InlineError
									message={
										conflict
											? "其他管理员已更新此组设置。你的输入已保留。"
											: `保存失败：${error.message}`
									}
									detail={
										conflict
											? "重新加载会丢弃输入，请加载最新版本后再编辑。"
											: undefined
									}
									onRetry={conflict ? state.onReload : undefined}
									retryLabel="加载最新版本"
									retrying={isPending}
								/>
							)}
							{Object.entries(state.errors).map(([key, fieldError]) =>
								fieldError &&
								typeof fieldError === "object" &&
								"message" in fieldError &&
								typeof fieldError.message === "string" ? (
									<InlineError key={key} message={fieldError.message} inline />
								) : null,
							)}
							{!state.canWrite && (
								<p role="status" className="text-sm text-muted-foreground">
									仅供查看：你没有修改设置的权限。
								</p>
							)}
							<SettingsFieldContext
								value={{ errors: state.errors, sources: meta.sources }}
							>
								<form id={formId} onSubmit={state.onSubmit} noValidate>
									<fieldset
										disabled={!state.canWrite || isPending}
										className="flex min-w-0 flex-col gap-6"
									>
										{children}
									</fieldset>
								</form>
							</SettingsFieldContext>
						</>
					)}
				</div>
			)}
			<ConfirmDialog
				open={resetOpen}
				onOpenChange={setResetOpen}
				title="恢复本组部署默认？"
				description="本组数据库覆盖值将被移除，当前未保存输入也会丢弃。其他设置组不受影响。生效时机以返回状态为准。"
				confirmLabel="恢复部署默认"
				loading={isPending}
				onConfirm={async () => {
					await state.onReset();
					setResetOpen(false);
				}}
			/>
		</PageShell>
	);
}
