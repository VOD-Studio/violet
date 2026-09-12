import { Button } from "@shared/ui/base/button";
import { Input } from "@shared/ui/base/input";
import { InlineError } from "@shared/ui/inline-error";
import { RefreshCw, Save } from "lucide-react";
import type { FormEventHandler } from "react";
import type { RuntimeLogPolicyLimits } from "../model/types";

export const BYTES_PER_MEBIBYTE = 1024 * 1024;

export interface RuntimeLogPolicyDraft {
	retentionDays: string;
	maxRecords: string;
	maxMebibytes: string;
}

interface RuntimeLogPolicyEditorState {
	draft: RuntimeLogPolicyDraft;
	limits: RuntimeLogPolicyLimits;
	dirty: boolean;
	serverChanged: boolean;
	error: string;
	isSaving: boolean;
	isRotating: boolean;
}

interface RuntimeLogPolicyEditorProps {
	state: RuntimeLogPolicyEditorState;
	onSubmit: FormEventHandler<HTMLFormElement>;
	onFieldChange: (field: keyof RuntimeLogPolicyDraft, value: string) => void;
	onRotate: () => void;
	onLoadServer: () => void;
}

/** 编辑保留边界，并明确呈现并发版本冲突与未保存状态。 */
export function RuntimeLogPolicyEditor({
	state,
	onSubmit,
	onFieldChange,
	onRotate,
	onLoadServer,
}: RuntimeLogPolicyEditorProps) {
	const { draft, limits, dirty, serverChanged, error, isSaving, isRotating } = state;
	return (
		<form onSubmit={onSubmit} className="space-y-3">
			<fieldset disabled={isSaving || isRotating} className="grid gap-3 sm:grid-cols-3">
				<label htmlFor="runtime-log-retention-days" className="space-y-1.5">
					<span>保留天数</span>
					<Input
						id="runtime-log-retention-days"
						type="number"
						min={limits.retention_days_min}
						max={limits.retention_days_max}
						step="1"
						value={draft.retentionDays}
						onChange={(event) => onFieldChange("retentionDays", event.target.value)}
					/>
					<span className="block text-muted-foreground">
						{limits.retention_days_min}–{limits.retention_days_max} 天
					</span>
				</label>
				<label htmlFor="runtime-log-max-records" className="space-y-1.5">
					<span>最大记录数</span>
					<Input
						id="runtime-log-max-records"
						type="number"
						min={limits.max_records_min}
						max={limits.max_records_max}
						step="1"
						value={draft.maxRecords}
						onChange={(event) => onFieldChange("maxRecords", event.target.value)}
					/>
					<span className="block text-muted-foreground">
						{limits.max_records_min.toLocaleString()}–
						{limits.max_records_max.toLocaleString()} 条
					</span>
				</label>
				<label htmlFor="runtime-log-max-mebibytes" className="space-y-1.5">
					<span>最大估算容量（MiB）</span>
					<Input
						id="runtime-log-max-mebibytes"
						type="number"
						min={limits.max_bytes_min / BYTES_PER_MEBIBYTE}
						max={limits.max_bytes_max / BYTES_PER_MEBIBYTE}
						step="1"
						value={draft.maxMebibytes}
						onChange={(event) => onFieldChange("maxMebibytes", event.target.value)}
					/>
					<span className="block text-muted-foreground">
						{limits.max_bytes_min / BYTES_PER_MEBIBYTE}–
						{limits.max_bytes_max / BYTES_PER_MEBIBYTE} MiB
					</span>
				</label>
			</fieldset>
			{serverChanged && (
				<InlineError
					message="服务器版本已变化；直接保存会被拒绝，不会覆盖他人的设置。"
					inline
				/>
			)}
			{error && <InlineError message={error} inline />}
			<div className="flex flex-wrap items-center gap-2">
				<Button type="submit" size="sm" disabled={!dirty || isSaving || isRotating}>
					<Save className="size-3.5" aria-hidden="true" />
					{isSaving ? "正在保存…" : "保存策略"}
				</Button>
				<Button
					type="button"
					size="sm"
					variant="outline"
					disabled={isRotating || isSaving}
					onClick={onRotate}
				>
					<RefreshCw className="size-3.5" aria-hidden="true" />
					{isRotating ? "正在轮转…" : "立即轮转"}
				</Button>
				{dirty && (
					<span role="status" className="text-muted-foreground">
						有未保存的策略修改
					</span>
				)}
				{serverChanged && (
					<Button type="button" size="sm" variant="ghost" onClick={onLoadServer}>
						加载服务器版本
					</Button>
				)}
			</div>
		</form>
	);
}
