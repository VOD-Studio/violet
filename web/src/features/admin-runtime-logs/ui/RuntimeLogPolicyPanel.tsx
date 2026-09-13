import { ApiError } from "@shared/api/error";
import { formatDateTime } from "@shared/lib/date";
import { formatBytes } from "@shared/lib/formatBytes";
import { ConfirmDialog } from "@shared/ui/confirm-dialog";
import { Disclosure } from "@shared/ui/disclosure";
import { InlineError } from "@shared/ui/inline-error";
import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import {
	useRotateRuntimeLogs,
	useRuntimeLogPolicy,
	useUpdateRuntimeLogPolicy,
} from "../api/queries";
import type { RuntimeLogPolicy } from "../model/types";
import {
	BYTES_PER_MEBIBYTE,
	type RuntimeLogPolicyDraft,
	RuntimeLogPolicyEditor,
} from "./RuntimeLogPolicyEditor";

const toDraft = (policy: RuntimeLogPolicy): RuntimeLogPolicyDraft => ({
	retentionDays: String(policy.retention_days),
	maxRecords: String(policy.max_records),
	maxMebibytes: String(policy.max_bytes / BYTES_PER_MEBIBYTE),
});

const parseInteger = (value: string) => {
	const parsed = Number(value);
	return Number.isSafeInteger(parsed) ? parsed : Number.NaN;
};

/** 展示运行日志专属保留策略；编辑使用版本号避免覆盖其他管理员的保存。 */
export function RuntimeLogPolicyPanel({ canManage }: { canManage: boolean }) {
	const query = useRuntimeLogPolicy();
	const update = useUpdateRuntimeLogPolicy();
	const rotate = useRotateRuntimeLogs();
	const [draft, setDraft] = useState<RuntimeLogPolicyDraft | null>(null);
	const [baseVersion, setBaseVersion] = useState<number | null>(null);
	const [dirty, setDirty] = useState(false);
	const [error, setError] = useState("");
	const [rotateOpen, setRotateOpen] = useState(false);

	const policy = query.data?.policy;
	useEffect(() => {
		if (!policy || dirty) return;
		setDraft(toDraft(policy));
		setBaseVersion(policy.version);
	}, [dirty, policy]);

	if (query.isPending) {
		return <p className="py-3 text-xs text-muted-foreground">正在读取日志保留策略…</p>;
	}
	if (!query.data) {
		return (
			<InlineError
				message={`日志保留策略读取失败：${query.error?.message ?? "未收到策略数据"}`}
				onRetry={() => void query.refetch()}
				retrying={query.isFetching}
			/>
		);
	}
	if (!draft || baseVersion === null) {
		return <p className="py-3 text-xs text-muted-foreground">正在同步日志保留策略…</p>;
	}

	const { policy: currentPolicy, usage, limits, rotation } = query.data;
	const currentDraft = draft;
	const currentBaseVersion = baseVersion;
	const serverChanged = dirty && currentPolicy.version !== currentBaseVersion;
	const overLimit =
		usage.records > currentPolicy.max_records || usage.payload_bytes > currentPolicy.max_bytes;

	const setField = (field: keyof RuntimeLogPolicyDraft, value: string) => {
		setDraft((current) => (current ? { ...current, [field]: value } : current));
		setDirty(true);
		setError("");
	};

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const retentionDays = parseInteger(currentDraft.retentionDays);
		const maxRecords = parseInteger(currentDraft.maxRecords);
		const maxMebibytes = parseInteger(currentDraft.maxMebibytes);
		const maxBytes = maxMebibytes * BYTES_PER_MEBIBYTE;
		if (
			!Number.isFinite(retentionDays) ||
			!Number.isFinite(maxRecords) ||
			!Number.isFinite(maxBytes) ||
			retentionDays < limits.retention_days_min ||
			retentionDays > limits.retention_days_max ||
			maxRecords < limits.max_records_min ||
			maxRecords > limits.max_records_max ||
			maxBytes < limits.max_bytes_min ||
			maxBytes > limits.max_bytes_max
		) {
			setError("请输入各字段提示范围内的整数。");
			return;
		}
		try {
			const result = await update.mutateAsync({
				expected_version: currentBaseVersion,
				retention_days: retentionDays,
				max_records: maxRecords,
				max_bytes: maxBytes,
			});
			setDraft(toDraft(result.policy));
			setBaseVersion(result.policy.version);
			setDirty(false);
			setError("");
			toast.success("保留策略已保存，轮转任务已调度");
		} catch (failure) {
			if (failure instanceof ApiError && failure.status === 409) {
				setError("策略已被其他管理员更新。当前输入已保留，请加载服务器版本后再修改。");
				void query.refetch();
				return;
			}
			setError(`策略保存失败：${failure instanceof Error ? failure.message : "未知错误"}`);
		}
	}

	async function handleRotate() {
		try {
			const result = await rotate.mutateAsync();
			setRotateOpen(false);
			toast.success(`轮转完成，删除 ${result.result.deleted.toLocaleString()} 条运行日志`);
		} catch (failure) {
			setError(`立即轮转失败：${failure instanceof Error ? failure.message : "未知错误"}`);
		}
	}

	return (
		<div className="min-w-0">
			<Disclosure
				label={
					<span
						className={
							overLimit || rotation.last_error ? "text-destructive" : undefined
						}
					>
						保留与容量
					</span>
				}
				hint={`${usage.records.toLocaleString()} / ${currentPolicy.max_records.toLocaleString()} 条 · ${formatBytes(usage.payload_bytes)} / ${formatBytes(currentPolicy.max_bytes)}`}
			>
				<div className="space-y-4 pb-4 text-xs">
					<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
						<div className="space-y-1">
							<p className="text-muted-foreground">保留窗口</p>
							<p>{currentPolicy.retention_days.toLocaleString()} 天</p>
						</div>
						<div className="space-y-1">
							<p className="text-muted-foreground">已保存策略</p>
							<p>
								v{currentPolicy.version} ·{" "}
								{formatDateTime(currentPolicy.updated_at, "second")}
							</p>
						</div>
						<div className="space-y-1">
							<p className="text-muted-foreground">执行策略</p>
							<p>
								{rotation.running
									? rotation.active_policy_version === undefined
										? "正在读取策略"
										: `正在按 v${rotation.active_policy_version} 轮转`
									: rotation.last_finished_at
										? `最近完成 v${rotation.last_policy_version}`
										: "尚未执行"}
							</p>
						</div>
						<div className="space-y-1">
							<p className="text-muted-foreground">最早接收时间</p>
							<p>
								{usage.oldest_received_at
									? formatDateTime(usage.oldest_received_at, "second")
									: "暂无记录"}
							</p>
						</div>
						<div className="space-y-1">
							<p className="text-muted-foreground">上次轮转</p>
							<p>
								{rotation.last_finished_at
									? `${formatDateTime(rotation.last_finished_at, "second")} · 删除 ${rotation.last_deleted.toLocaleString()} 条`
									: "尚未完成"}
							</p>
						</div>
						<div className="space-y-1">
							<p className="text-muted-foreground">下次检查</p>
							<p>{formatDateTime(rotation.next_run_at, "second")}</p>
						</div>
					</div>
					<p className="leading-relaxed text-muted-foreground">
						轮转每 5
						分钟检查一次，保存后立即安排一次；每次执行开始时读取已保存版本。上限是轮转后的目标值，后续新日志可暂时超过。仅删除运行日志，不处理操作审计。
					</p>
					{rotation.last_error && (
						<InlineError message={`最近轮转失败：${rotation.last_error}`} inline />
					)}
					{rotation.remaining_over_limit && (
						<InlineError
							message="单次轮转批次已用尽，仍有超限记录；下一轮会继续处理。"
							inline
						/>
					)}
					{query.isError && (
						<InlineError
							message={`策略状态更新失败，以上为上次成功结果：${query.error.message}`}
							onRetry={() => void query.refetch()}
							retrying={query.isFetching}
						/>
					)}
					{canManage ? (
						<RuntimeLogPolicyEditor
							state={{
								draft,
								limits,
								dirty,
								serverChanged,
								error,
								isSaving: update.isPending,
								isRotating: rotate.isPending,
							}}
							onSubmit={handleSubmit}
							onFieldChange={setField}
							onRotate={() => setRotateOpen(true)}
							onLoadServer={() => {
								setDraft(toDraft(currentPolicy));
								setBaseVersion(currentPolicy.version);
								setDirty(false);
								setError("");
							}}
						/>
					) : (
						<p role="status" className="text-muted-foreground">
							仅供查看：需要 runtimelog:manage 才能修改策略或立即轮转。
						</p>
					)}
				</div>
			</Disclosure>
			<ConfirmDialog
				open={rotateOpen}
				onOpenChange={setRotateOpen}
				title="立即轮转运行日志？"
				description="将按当前保留天数、最大记录数与估算容量删除最旧运行日志。操作审计不受影响。"
				confirmLabel="立即轮转"
				loading={rotate.isPending}
				onConfirm={() => void handleRotate()}
			/>
		</div>
	);
}
