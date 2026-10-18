import { ListChecks } from "lucide-react";
import type { ChecklistProgress } from "../lib/roadmap-checklist";

export interface ChecklistMeterProps {
	progress: ChecklistProgress;
	className?: string;
}

/**
 * 子项完成度：图标、「完成数/总数」与一条细进度条。
 *
 * 数字是主要信息，进度条只是辅助，所以对读屏隐藏条、数字前补一句「子项已完成：」。
 */
export function ChecklistMeter({ progress, className }: ChecklistMeterProps) {
	const percent = progress.total === 0 ? 0 : Math.round((progress.done / progress.total) * 100);
	return (
		<span className={`inline-flex items-center gap-1.5 tabular-nums ${className ?? ""}`}>
			<ListChecks className="size-3.5 shrink-0" aria-hidden="true" />
			<span>
				<span className="sr-only">子项已完成：</span>
				{progress.done}/{progress.total}
			</span>
			<span aria-hidden="true" className="h-1 w-10 overflow-hidden rounded-full bg-muted">
				<span
					className="block h-full rounded-full bg-primary"
					style={{ width: `${percent}%` }}
				/>
			</span>
		</span>
	);
}
