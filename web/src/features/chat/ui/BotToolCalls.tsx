import { cn } from "cn";
import { AlertTriangle, Check, LoaderCircle } from "lucide-react";
import type { BotToolCall } from "../model/types";

type ToolCallVisualStatus = "running" | "completed" | "failed" | "unfinished";

const TOOL_CALL_LABELS: Record<ToolCallVisualStatus, string> = {
	running: "运行中",
	completed: "已完成",
	failed: "失败",
	unfinished: "未完成",
};

const ACTION_ROW_CLASS: Record<ToolCallVisualStatus, string> = {
	running: "text-muted-foreground",
	completed: "text-success",
	failed: "text-destructive",
	unfinished: "text-warning",
};

function ToolCallStatusIcon({ status }: { status: ToolCallVisualStatus }) {
	if (status === "running") {
		return (
			<LoaderCircle
				aria-hidden="true"
				className={cn("size-3.5 shrink-0 animate-spin", ACTION_ROW_CLASS.running)}
			/>
		);
	}
	if (status === "completed") {
		return (
			<Check
				aria-hidden="true"
				className={cn("size-3.5 shrink-0", ACTION_ROW_CLASS.completed)}
			/>
		);
	}
	return (
		<AlertTriangle
			aria-hidden="true"
			className={cn("size-3.5 shrink-0", ACTION_ROW_CLASS[status])}
		/>
	);
}

function ToolCallDetail({
	label,
	value,
	tone,
}: {
	label: string;
	value: string;
	tone?: "destructive";
}) {
	return (
		<div className="mt-2 min-w-0">
			<span
				className={cn(
					"text-xs",
					tone === "destructive" ? "text-destructive" : "text-muted-foreground",
				)}
			>
				{label}
			</span>
			<pre
				className={cn(
					"mt-1 min-w-0 rounded bg-muted px-2 py-1.5 font-mono text-xs whitespace-pre-wrap wrap-break-word text-foreground",
					tone === "destructive" && "bg-destructive/5 text-destructive",
				)}
			>
				{value}
			</pre>
		</div>
	);
}

export function ToolCallBlock({
	call,
	replySettled,
}: {
	call: BotToolCall;
	replySettled: boolean;
}) {
	// 终态回复仍可能带着 running 的旧快照，此时按「未完成」呈现，不再转圈。
	const status: ToolCallVisualStatus =
		call.status === "running" && replySettled ? "unfinished" : call.status;
	const duration =
		typeof call.duration_ms === "number"
			? call.duration_ms < 1000
				? `${Math.round(call.duration_ms)}ms`
				: `${(call.duration_ms / 1000).toFixed(1)}s`
			: undefined;
	return (
		<li className="min-w-0 rounded-lg border border-border/60 px-2.5 py-2">
			<div className="flex min-w-0 flex-wrap items-center gap-1.5">
				<ToolCallStatusIcon status={status} />
				<code className="min-w-0 font-mono text-xs wrap-anywhere">{call.name}</code>
				<span className={cn("text-xs", ACTION_ROW_CLASS[status])}>
					{TOOL_CALL_LABELS[status]}
				</span>
				{duration && (
					<span className="ml-auto font-mono text-xs text-muted-foreground">
						{duration}
					</span>
				)}
			</div>
			{call.arguments ? <ToolCallDetail label="参数" value={call.arguments} /> : null}
			{call.result ? <ToolCallDetail label="结果" value={call.result} /> : null}
			{call.error ? (
				<ToolCallDetail label="错误" value={call.error} tone="destructive" />
			) : null}
		</li>
	);
}
