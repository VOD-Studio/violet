import { formatDateTime } from "@shared/lib/date";
import { Badge } from "@shared/ui/base/badge";
import { Button } from "@shared/ui/base/button";
import { Input } from "@shared/ui/base/input";
import { Switch } from "@shared/ui/base/switch";
import { ConfirmDialog } from "@shared/ui/confirm-dialog";
import { Modal } from "@shared/ui/modal";
import { useQueryClient } from "@tanstack/react-query";
import {
	Archive,
	CalendarClock,
	DatabaseBackup,
	Download as DownloadIcon,
	FileArchive,
	Loader2,
	RefreshCw,
	RotateCcw,
	Save,
	Trash2,
	Upload,
} from "lucide-react";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { systemKeys } from "../api/keys";
import {
	useCreateBackup,
	useDeleteBackup,
	useDownloadBackup,
	useImportBackup,
	useRestoreBackup,
	useUpdateBackupSettings,
} from "../api/mutations";
import { useBackups, useBackupTask } from "../api/queries";
import type { BackupInfoDTO, BackupSettingsDTO, BackupTaskDTO } from "../model/types";
import { saveDownloadedFile } from "./download";
import { formatBytes } from "./format";

const maxImportBytes = 512 * 1024 * 1024;
const originLabels: Record<BackupInfoDTO["origin"], string> = {
	manual: "手动",
	auto: "自动",
	import: "导入",
};

/** 数据库备份、导入、恢复与自动调度页签。 */
export function BackupRestoreTab() {
	const queryClient = useQueryClient();
	const backupsQuery = useBackups();
	const createBackup = useCreateBackup();
	const importBackup = useImportBackup();
	const downloadBackup = useDownloadBackup();
	const restoreBackup = useRestoreBackup();
	const deleteBackup = useDeleteBackup();
	const updateSettings = useUpdateBackupSettings();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const settledTaskRef = useRef<string | null>(null);
	const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
	const [manualUploads, setManualUploads] = useState(true);
	const [settings, setSettings] = useState<BackupSettingsDTO | null>(null);
	const [restoreTarget, setRestoreTarget] = useState<BackupInfoDTO | null>(null);
	const [restoreText, setRestoreText] = useState("");
	const [deleteTarget, setDeleteTarget] = useState<BackupInfoDTO | null>(null);
	const taskQuery = useBackupTask(activeTaskId);

	useEffect(() => {
		if (!settings && backupsQuery.data) {
			const current = backupsQuery.data.settings;
			setSettings({
				auto_enabled: current.auto_enabled,
				time_utc: current.time_utc,
				retention_count: current.retention_count,
				include_uploads: current.include_uploads,
			});
		}
	}, [backupsQuery.data, settings]);

	useEffect(() => {
		const task = taskQuery.data;
		if (!task || task.status === "running" || settledTaskRef.current === task.id) return;
		settledTaskRef.current = task.id;
		void queryClient.invalidateQueries({ queryKey: systemKeys.backups() });
		if (task.status === "succeeded") {
			toast.success(task.kind === "backup" ? "数据库备份已完成" : "数据库恢复已完成");
		} else {
			toast.error(task.error || "维护任务失败");
		}
	}, [queryClient, taskQuery.data]);

	const trackTask = (id: string) => {
		settledTaskRef.current = null;
		setActiveTaskId(id);
	};

	const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file) return;
		if (file.size > maxImportBytes) {
			toast.error("备份文件不能超过 512MB");
			return;
		}
		importBackup.mutate(file, {
			onSuccess: () => toast.success("签名校验通过，备份已导入"),
			onError: (error) => toast.error(error.message),
		});
	};

	const handleDownload = (filename: string, part: "database" | "uploads") => {
		downloadBackup.mutate(
			{ filename, part },
			{
				onSuccess: saveDownloadedFile,
				onError: (error) => toast.error(error.message),
			},
		);
	};

	return (
		<div className="space-y-6 pt-5">
			{taskQuery.data && <TaskStatus task={taskQuery.data} />}

			<div className="grid gap-6 xl:grid-cols-2">
				<section className="rounded-xl border bg-card p-5">
					<div className="flex items-start justify-between gap-3">
						<div>
							<h2 className="flex items-center gap-2 text-sm font-semibold">
								<DatabaseBackup className="text-primary size-4" />
								手动维护
							</h2>
							<p className="text-muted-foreground mt-1 text-xs">
								备份与恢复同一时间只运行一个任务
							</p>
						</div>
						<Badge variant="outline">pg_dump / psql</Badge>
					</div>
					<div className="mt-5 flex items-center justify-between gap-3 rounded-lg border px-3.5 py-3">
						<span>
							<span className="block text-sm font-medium">附带上传目录</span>
							<span className="text-muted-foreground mt-0.5 block text-xs">
								生成独立 tar.gz，仅供下载与人工恢复
							</span>
						</span>
						<Switch
							aria-label="附带上传目录"
							checked={manualUploads}
							onCheckedChange={setManualUploads}
							size="sm"
						/>
					</div>
					<div className="mt-4 flex flex-wrap gap-2">
						<Button
							disabled={
								createBackup.isPending || taskQuery.data?.status === "running"
							}
							onClick={() =>
								createBackup.mutate(manualUploads, {
									onSuccess: (task) => {
										trackTask(task.id);
										toast.success("备份任务已启动");
									},
									onError: (error) => toast.error(error.message),
								})
							}
						>
							{createBackup.isPending ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<Archive className="size-4" />
							)}
							创建备份
						</Button>
						<Button
							variant="outline"
							disabled={
								importBackup.isPending || taskQuery.data?.status === "running"
							}
							onClick={() => fileInputRef.current?.click()}
						>
							{importBackup.isPending ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<Upload className="size-4" />
							)}
							导入签名备份
						</Button>
						<input
							ref={fileInputRef}
							type="file"
							accept=".sql,text/plain,application/sql"
							className="sr-only"
							onChange={handleImport}
						/>
					</div>
				</section>

				<BackupSettings
					value={settings}
					lastRun={backupsQuery.data?.settings.last_run}
					nextRunAt={backupsQuery.data?.settings.next_run_at}
					pending={updateSettings.isPending}
					onChange={setSettings}
					onSave={() => {
						if (!settings) return;
						updateSettings.mutate(settings, {
							onSuccess: (saved) => {
								setSettings(saved);
								toast.success("自动备份设置已保存");
							},
							onError: (error) => toast.error(error.message),
						});
					}}
				/>
			</div>

			<section className="overflow-hidden rounded-xl border bg-card">
				<div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
					<div>
						<h2 className="text-sm font-semibold">备份清单</h2>
						<p className="text-muted-foreground mt-1 text-xs">
							SQL 文件带实例签名；上传归档不会随数据库一键恢复
						</p>
					</div>
					<Button
						variant="ghost"
						size="sm"
						disabled={backupsQuery.isFetching}
						onClick={() => void backupsQuery.refetch()}
					>
						<RefreshCw
							className={`size-3.5 ${backupsQuery.isFetching ? "animate-spin" : ""}`}
						/>
						刷新
					</Button>
				</div>
				<BackupTable
					items={backupsQuery.data?.backups ?? []}
					loading={backupsQuery.isLoading}
					error={backupsQuery.error}
					actionPending={
						downloadBackup.isPending ||
						deleteBackup.isPending ||
						restoreBackup.isPending
					}
					onDownload={handleDownload}
					onRestore={(backup) => {
						setRestoreText("");
						setRestoreTarget(backup);
					}}
					onDelete={setDeleteTarget}
				/>
			</section>

			<RestoreDialog
				target={restoreTarget}
				confirmation={restoreText}
				pending={restoreBackup.isPending}
				onConfirmationChange={setRestoreText}
				onClose={() => setRestoreTarget(null)}
				onConfirm={() => {
					if (!restoreTarget) return;
					restoreBackup.mutate(restoreTarget.filename, {
						onSuccess: (task) => {
							trackTask(task.id);
							setRestoreTarget(null);
							toast.success("恢复任务已启动");
						},
						onError: (error) => toast.error(error.message),
					});
				}}
			/>

			<ConfirmDialog
				open={!!deleteTarget}
				onOpenChange={(open) => {
					if (!open) setDeleteTarget(null);
				}}
				title="删除数据库备份"
				description={`将永久删除 ${deleteTarget?.filename ?? ""} 及其配对上传归档。此操作不可撤销。`}
				confirmLabel="删除备份"
				loading={deleteBackup.isPending}
				onConfirm={() => {
					if (!deleteTarget) return;
					deleteBackup.mutate(deleteTarget.filename, {
						onSuccess: () => {
							setDeleteTarget(null);
							toast.success("备份已删除");
						},
						onError: (error) => toast.error(error.message),
					});
				}}
			/>
		</div>
	);
}

interface BackupSettingsProps {
	value: BackupSettingsDTO | null;
	lastRun?: { at: string; ok: boolean; filename?: string; error?: string };
	nextRunAt?: string;
	pending: boolean;
	onChange: (value: BackupSettingsDTO) => void;
	onSave: () => void;
}

function BackupSettings({
	value,
	lastRun,
	nextRunAt,
	pending,
	onChange,
	onSave,
}: BackupSettingsProps) {
	return (
		<section className="rounded-xl border bg-card p-5">
			<div className="flex items-start justify-between gap-3">
				<div>
					<h2 className="flex items-center gap-2 text-sm font-semibold">
						<CalendarClock className="text-primary size-4" />
						自动备份
					</h2>
					<p className="text-muted-foreground mt-1 text-xs">
						每天按 UTC 时间运行，仅轮转自动备份
					</p>
				</div>
				<Switch
					aria-label="启用自动备份"
					checked={value?.auto_enabled ?? false}
					disabled={!value}
					onCheckedChange={(autoEnabled) =>
						value && onChange({ ...value, auto_enabled: autoEnabled })
					}
				/>
			</div>
			<div className="mt-5 grid gap-4 sm:grid-cols-2">
				<label htmlFor="backup-time-utc" className="space-y-1.5 text-sm font-medium">
					<span>执行时间（UTC）</span>
					<Input
						id="backup-time-utc"
						type="time"
						value={value?.time_utc ?? "04:00"}
						disabled={!value}
						onChange={(event) =>
							value && onChange({ ...value, time_utc: event.target.value })
						}
					/>
				</label>
				<label htmlFor="backup-retention-count" className="space-y-1.5 text-sm font-medium">
					<span>保留份数</span>
					<Input
						id="backup-retention-count"
						type="number"
						min={1}
						max={365}
						value={value?.retention_count ?? 30}
						disabled={!value}
						onChange={(event) =>
							value &&
							onChange({ ...value, retention_count: Number(event.target.value) })
						}
					/>
				</label>
			</div>
			<div className="mt-4 flex items-center justify-between gap-3 rounded-lg border px-3.5 py-3">
				<span>
					<span className="block text-sm font-medium">自动打包上传目录</span>
					<span className="text-muted-foreground mt-0.5 block text-xs">
						生成独立 tar.gz 附件
					</span>
				</span>
				<Switch
					aria-label="自动打包上传目录"
					checked={value?.include_uploads ?? false}
					disabled={!value}
					onCheckedChange={(includeUploads) =>
						value && onChange({ ...value, include_uploads: includeUploads })
					}
					size="sm"
				/>
			</div>
			<div className="text-muted-foreground mt-4 space-y-1 text-xs">
				<p>下次执行：{nextRunAt ? formatDateTime(nextRunAt, "second") : "未启用"}</p>
				<p>
					最近结果：
					{lastRun
						? `${lastRun.ok ? "成功" : "失败"} · ${formatDateTime(lastRun.at, "second")}`
						: "暂无记录"}
				</p>
			</div>
			<Button
				className="mt-5 w-full"
				variant="outline"
				disabled={!value || pending}
				onClick={onSave}
			>
				{pending ? (
					<Loader2 className="size-4 animate-spin" />
				) : (
					<Save className="size-4" />
				)}
				保存自动备份设置
			</Button>
		</section>
	);
}

function BackupTable({
	items,
	loading,
	error,
	actionPending,
	onDownload,
	onRestore,
	onDelete,
}: {
	items: BackupInfoDTO[];
	loading: boolean;
	error: Error | null;
	actionPending: boolean;
	onDownload: (filename: string, part: "database" | "uploads") => void;
	onRestore: (backup: BackupInfoDTO) => void;
	onDelete: (backup: BackupInfoDTO) => void;
}) {
	if (loading) {
		return (
			<div className="text-muted-foreground flex items-center justify-center gap-2 py-16 text-sm">
				<Loader2 className="size-4 animate-spin" />
				读取备份清单
			</div>
		);
	}
	if (error)
		return <p className="text-destructive px-5 py-12 text-center text-sm">{error.message}</p>;
	if (items.length === 0) {
		return (
			<p className="text-muted-foreground px-5 py-16 text-center text-sm">还没有可用备份</p>
		);
	}
	return (
		<div className="overflow-x-auto">
			<table className="w-full min-w-200 text-left text-sm">
				<caption className="sr-only">数据库备份清单</caption>
				<thead className="bg-muted/70 text-muted-foreground text-xs">
					<tr>
						<th className="px-4 py-2.5 font-medium">备份文件</th>
						<th className="px-4 py-2.5 font-medium">来源</th>
						<th className="px-4 py-2.5 font-medium">创建时间</th>
						<th className="px-4 py-2.5 text-right font-medium">大小</th>
						<th className="px-4 py-2.5 text-right font-medium">操作</th>
					</tr>
				</thead>
				<tbody className="divide-y">
					{items.map((backup) => (
						<tr key={backup.filename}>
							<td className="px-4 py-3">
								<p className="max-w-96 truncate font-mono text-xs">
									{backup.filename}
								</p>
								<p className="text-muted-foreground mt-1 text-xs">
									{backup.database_tool || "工具版本未知"}
								</p>
							</td>
							<td className="px-4 py-3">
								<Badge variant="outline">{originLabels[backup.origin]}</Badge>
							</td>
							<td className="px-4 py-3 whitespace-nowrap">
								{formatDateTime(backup.created_at, "second")}
							</td>
							<td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
								{formatBytes(backup.size)}
								{backup.uploads_size ? (
									<span className="text-muted-foreground mt-1 block">
										+ {formatBytes(backup.uploads_size)}
									</span>
								) : null}
							</td>
							<td className="px-4 py-3">
								<div className="flex justify-end gap-1">
									<Button
										variant="ghost"
										size="icon-sm"
										disabled={actionPending}
										title="下载数据库"
										aria-label={`下载 ${backup.filename}`}
										onClick={() => onDownload(backup.filename, "database")}
									>
										<DownloadIcon className="size-3.5" />
									</Button>
									{backup.uploads_filename && (
										<Button
											variant="ghost"
											size="icon-sm"
											disabled={actionPending}
											title="下载上传归档"
											aria-label={`下载 ${backup.uploads_filename}`}
											onClick={() => onDownload(backup.filename, "uploads")}
										>
											<FileArchive className="size-3.5" />
										</Button>
									)}
									<Button
										variant="ghost"
										size="icon-sm"
										disabled={actionPending}
										title="恢复数据库"
										aria-label={`恢复 ${backup.filename}`}
										onClick={() => onRestore(backup)}
									>
										<RotateCcw className="size-3.5" />
									</Button>
									<Button
										className="text-destructive hover:bg-destructive/10 hover:text-destructive"
										variant="ghost"
										size="icon-sm"
										disabled={actionPending}
										title="删除备份"
										aria-label={`删除 ${backup.filename}`}
										onClick={() => onDelete(backup)}
									>
										<Trash2 className="size-3.5" />
									</Button>
								</div>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function TaskStatus({ task }: { task: BackupTaskDTO }) {
	const isRunning = task.status === "running";
	return (
		<section className="rounded-xl border bg-card px-4 py-3" aria-live="polite">
			<div className="flex items-center justify-between gap-3">
				<div className="flex min-w-0 items-center gap-2">
					{isRunning && <Loader2 className="text-primary size-4 shrink-0 animate-spin" />}
					<div className="min-w-0">
						<p className="truncate text-sm font-medium">{task.message}</p>
						{task.error && (
							<p className="text-destructive mt-1 text-xs">{task.error}</p>
						)}
					</div>
				</div>
				<span className="font-mono text-xs tabular-nums">{task.progress}%</span>
			</div>
			<div
				className="bg-muted mt-3 h-1.5 overflow-hidden rounded-full"
				role="progressbar"
				aria-valuenow={task.progress}
				aria-valuemin={0}
				aria-valuemax={100}
			>
				<div
					className="bg-primary h-full rounded-full transition-[width] duration-300"
					style={{ width: `${task.progress}%` }}
				/>
			</div>
		</section>
	);
}

function RestoreDialog({
	target,
	confirmation,
	pending,
	onConfirmationChange,
	onClose,
	onConfirm,
}: {
	target: BackupInfoDTO | null;
	confirmation: string;
	pending: boolean;
	onConfirmationChange: (value: string) => void;
	onClose: () => void;
	onConfirm: () => void;
}) {
	return (
		<Modal
			open={!!target}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
			title="恢复数据库"
			description="恢复会在单个事务中重放 SQL，期间请勿执行其他维护操作。上传归档不会自动恢复。"
			size="sm"
			showCloseButton={!pending}
			footer={
				<>
					<Button variant="outline" disabled={pending} onClick={onClose}>
						取消
					</Button>
					<Button
						variant="destructive"
						disabled={pending || confirmation !== target?.filename}
						onClick={onConfirm}
					>
						{pending && <Loader2 className="size-4 animate-spin" />}
						开始恢复
					</Button>
				</>
			}
		>
			<label htmlFor="backup-restore-confirmation" className="space-y-2 text-sm font-medium">
				<span>输入完整文件名以确认</span>
				<code className="bg-muted block break-all rounded-md px-3 py-2 text-xs">
					{target?.filename}
				</code>
				<Input
					id="backup-restore-confirmation"
					autoFocus
					value={confirmation}
					disabled={pending}
					onChange={(event) => onConfirmationChange(event.target.value)}
					placeholder={target?.filename}
				/>
			</label>
		</Modal>
	);
}
