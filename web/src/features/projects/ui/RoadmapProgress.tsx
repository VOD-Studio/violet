import { ROADMAP_STAGE_LABELS, ROADMAP_STAGES } from "../lib/roadmap-board";
import type { RoadmapProgress as RoadmapProgressData } from "../model/roadmap-summary";

export interface RoadmapProgressProps {
	progress: RoadmapProgressData;
}

/** 进度概览：已完成占比的进度条，与三个阶段各自的条目数。 */
export function RoadmapProgress({ progress }: RoadmapProgressProps) {
	return (
		<section aria-label="进度概览" className="w-full space-y-3 md:max-w-xs">
			<div className="flex items-baseline justify-between gap-4">
				<span className="font-mono text-3xl font-bold tabular-nums">
					{progress.percent}%
				</span>
				<span className="text-sm text-muted-foreground tabular-nums">
					已完成 {progress.completed} / {progress.total}
				</span>
			</div>
			<div
				role="progressbar"
				aria-label="已完成占比"
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={progress.percent}
				className="h-2 overflow-hidden rounded-full bg-muted"
			>
				<div
					className="h-full rounded-full bg-primary"
					style={{ width: `${progress.percent}%` }}
				/>
			</div>
			<dl className="flex gap-4 text-sm">
				{ROADMAP_STAGES.map((stage) => (
					<div key={stage} className="flex items-baseline gap-1.5">
						<dt className="text-muted-foreground">{ROADMAP_STAGE_LABELS[stage]}</dt>
						<dd className="font-mono tabular-nums">{progress[stage]}</dd>
					</div>
				))}
			</dl>
		</section>
	);
}
