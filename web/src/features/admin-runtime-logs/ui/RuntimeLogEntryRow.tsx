import { formatDateTime } from "@shared/lib/date";
import { cn } from "@shared/lib/utils";
import { Disclosure } from "@shared/ui/disclosure";
import type { RuntimeLogEntry, RuntimeLogLevel } from "../model/types";

const LEVEL_CLASSES: Record<RuntimeLogLevel, string> = {
	trace: "text-muted-foreground",
	debug: "text-muted-foreground",
	info: "text-foreground",
	warn: "font-medium text-foreground",
	error: "text-destructive",
	fatal: "font-semibold text-destructive",
	panic: "font-semibold text-destructive",
};

/** 保留服务端接收顺序与原始消息，标识仅在日志自带时显示。 */
export function RuntimeLogEntryRow({ entry }: { entry: RuntimeLogEntry }) {
	return (
		<li data-runtime-log-id={entry.id} className="min-w-0 px-3 py-4 sm:px-4">
			<article className="grid min-w-0 gap-2 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-4">
				<div className="min-w-0 space-y-1 text-xs">
					<p className="font-mono tabular-nums">
						<span className="sr-only">发生时间：</span>
						<time dateTime={entry.occurred_at} title={entry.occurred_at}>
							{formatDateTime(entry.occurred_at, "second")}
						</time>
					</p>
					<p className="wrap-anywhere text-muted-foreground">
						接收序号 <span className="font-mono">{entry.id}</span>
					</p>
				</div>
				<div className="min-w-0 space-y-2">
					<div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
						<span className={cn("font-mono", LEVEL_CLASSES[entry.level])}>
							{entry.level.toUpperCase()}
						</span>
						<span className="min-w-0 wrap-anywhere text-muted-foreground">
							来源：{entry.source}
						</span>
					</div>
					<pre className="m-0 min-w-0 whitespace-pre-wrap wrap-anywhere font-mono text-xs leading-relaxed text-foreground sm:text-[13px]">
						{entry.message}
					</pre>
					<Disclosure
						label={`时间与关联标识${entry.request_id || entry.trace_id ? " · 有关联标识" : ""}`}
						className="text-xs text-muted-foreground"
						contentClassName="mt-2"
					>
						<dl className="grid min-w-0 gap-2">
							{(
								[
									["发生时间", entry.occurred_at],
									["接收时间", entry.received_at],
									["Request ID", entry.request_id],
									["Trace ID", entry.trace_id],
								] as const
							).map(([label, value]) =>
								value ? (
									<div
										key={label}
										className="grid min-w-0 gap-1 sm:grid-cols-[6rem_minmax(0,1fr)]"
									>
										<dt>{label}</dt>
										<dd className="min-w-0 whitespace-pre-wrap wrap-anywhere font-mono text-foreground">
											{value}
										</dd>
									</div>
								) : null,
							)}
						</dl>
					</Disclosure>
				</div>
			</article>
		</li>
	);
}
