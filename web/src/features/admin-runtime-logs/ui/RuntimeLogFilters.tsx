import { Button } from "@shared/ui/base/button";
import { Checkbox } from "@shared/ui/base/checkbox";
import { Input } from "@shared/ui/base/input";
import { DateTimeRangePickerField, type DateTimeRangePreset } from "@shared/ui/date-time-picker";
import { Disclosure } from "@shared/ui/disclosure";
import { InlineError } from "@shared/ui/inline-error";
import { addDays, addHours, format } from "date-fns";
import { type FormEvent, useState } from "react";
import type { RuntimeLogFilter, RuntimeLogLevel } from "../model/types";

const LEVELS: RuntimeLogLevel[] = ["trace", "debug", "info", "warn", "error", "fatal", "panic"];
const TEXT_FIELDS = [
	{ name: "source", label: "来源", placeholder: "精确匹配来源" },
	{ name: "keyword", label: "消息关键词", placeholder: "搜索消息内容" },
	{ name: "request_id", label: "Request ID", placeholder: "已有请求标识" },
	{ name: "trace_id", label: "Trace ID", placeholder: "已有追踪标识" },
] as const;
const EMPTY_DRAFT = {
	levels: [] as RuntimeLogLevel[],
	source: "",
	keyword: "",
	request_id: "",
	trace_id: "",
	from: "",
	until: "",
};

const toPickerValue = (date: Date) => format(date, "yyyy-MM-dd'T'HH:mm");

/** 相对时间快捷区间，起点已含、终点不含，与应用筛选的语义一致。 */
function buildTimePresets(): DateTimeRangePreset[] {
	const now = new Date();
	return [
		{
			label: "最近 1 小时",
			value: { start: toPickerValue(addHours(now, -1)), end: toPickerValue(now) },
		},
		{
			label: "最近 24 小时",
			value: { start: toPickerValue(addHours(now, -24)), end: toPickerValue(now) },
		},
		{
			label: "最近 7 天",
			value: { start: toPickerValue(addDays(now, -7)), end: toPickerValue(now) },
		},
		{
			label: "最近 30 天",
			value: { start: toPickerValue(addDays(now, -30)), end: toPickerValue(now) },
		},
	];
}

/** 提交后应用筛选；编辑中的条件不触发历史请求。 */
export interface RuntimeLogFiltersProps {
	filters: RuntimeLogFilter;
	onApply: (filters: RuntimeLogFilter) => void;
}

export function RuntimeLogFilters({ filters, onApply }: RuntimeLogFiltersProps) {
	const [draft, setDraft] = useState(EMPTY_DRAFT);
	const [error, setError] = useState("");
	const activeCount = Object.values(filters).filter((value) =>
		Array.isArray(value) ? value.length > 0 : Boolean(value),
	).length;
	const timePresets = buildTimePresets();

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const from = draft.from ? new Date(draft.from) : undefined;
		const until = draft.until ? new Date(draft.until) : undefined;
		if ((from && Number.isNaN(from.getTime())) || (until && Number.isNaN(until.getTime()))) {
			setError("请输入有效的开始和结束时间。");
			return;
		}
		if (from && until && from >= until) {
			setError("结束时间必须晚于开始时间；结束时刻本身不包含在结果中。");
			return;
		}
		setError("");
		onApply({
			levels: draft.levels.length ? draft.levels : undefined,
			source: draft.source.trim() || undefined,
			keyword: draft.keyword.trim() || undefined,
			request_id: draft.request_id.trim() || undefined,
			trace_id: draft.trace_id.trim() || undefined,
			from: from?.toISOString(),
			until: until?.toISOString(),
		});
	}

	function handleReset() {
		setDraft(EMPTY_DRAFT);
		setError("");
		onApply({});
	}

	return (
		<Disclosure
			label="筛选日志"
			hint={activeCount ? `已应用 ${activeCount} 项条件` : "全部已采集级别 · 不限时间"}
			className="border-b border-edge-hairline"
			contentClassName="pb-4"
		>
			<form onSubmit={handleSubmit} className="space-y-4">
				<fieldset className="space-y-2">
					<legend className="text-sm">级别（可多选，不选表示全部）</legend>
					<div className="flex flex-wrap gap-x-4 gap-y-2">
						{LEVELS.map((level) => (
							<label
								htmlFor={`runtime-log-level-${level}`}
								key={level}
								className="flex cursor-pointer items-center gap-2 py-1 text-xs"
							>
								<Checkbox
									id={`runtime-log-level-${level}`}
									checked={draft.levels.includes(level)}
									onCheckedChange={(checked) =>
										setDraft((current) => ({
											...current,
											levels:
												checked === true
													? LEVELS.filter(
															(item) =>
																item === level ||
																current.levels.includes(item),
														)
													: current.levels.filter(
															(item) => item !== level,
														),
										}))
									}
								/>
								{level.toUpperCase()}
							</label>
						))}
					</div>
				</fieldset>
				<div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
					{TEXT_FIELDS.map((field) => (
						<label
							htmlFor={`runtime-log-${field.name}`}
							key={field.name}
							className="min-w-0 space-y-1.5 text-xs"
						>
							<span>{field.label}</span>
							<Input
								id={`runtime-log-${field.name}`}
								name={field.name}
								value={draft[field.name]}
								onChange={(event) =>
									setDraft({ ...draft, [field.name]: event.target.value })
								}
								placeholder={field.placeholder}
								autoComplete="off"
							/>
						</label>
					))}
					<DateTimeRangePickerField
						label="时间范围（开始包含，结束不含）"
						value={{ start: draft.from || undefined, end: draft.until || undefined }}
						onChange={(range) =>
							setDraft((current) => ({
								...current,
								from: range.start ?? "",
								until: range.end ?? "",
							}))
						}
						presets={timePresets}
						placeholder="选择起止时间"
					/>
				</div>
				<p className="text-xs leading-relaxed text-muted-foreground">
					时间按当前设备时区输入，筛选日志的发生时间。筛选不能补采源端已丢弃的
					TRACE；仅展示日志中已有的请求与追踪标识。
				</p>
				{error && <InlineError message={error} inline />}
				<div className="flex flex-wrap gap-2">
					<Button type="submit" size="sm">
						应用筛选
					</Button>
					<Button type="button" variant="outline" size="sm" onClick={handleReset}>
						重置筛选
					</Button>
				</div>
			</form>
		</Disclosure>
	);
}
