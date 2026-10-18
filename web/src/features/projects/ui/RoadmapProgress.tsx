import { ROADMAP_STAGE_LABELS, ROADMAP_STAGES } from "../lib/roadmap-board";
import type { RoadmapProgress as RoadmapProgressData } from "../model/roadmap-summary";
import { StageDot } from "./StageDot";

export interface RoadmapProgressProps {
	progress: RoadmapProgressData;
}

/**
 * 进度概览：已完成占比，一条按阶段分段着色的进度条，与三个阶段各自的条目数。
 *
 * 进度条的值只算已完成；进行中的那一段是辅助信息，读屏从下方的计数读到。
 */
export function RoadmapProgress({ progress }: RoadmapProgressProps) {
	const share = (count: number) => (progress.total === 0 ? 0 : (count / progress.total) * 100);
	return (
		<section aria-label="进度概览" className="w-full space-y-3 md:w-80">
			<div className="flex items-baseline justify-between gap-4">
				<span className="text-3xl font-normal tracking-[-0.02em] tabular-nums">
					{progress.percent}
					<span className="ml-0.5 text-base text-muted-foreground">%</span>
				</span>
				<span className="font-mono text-xs text-muted-foreground tabular-nums">
					已完成 {progress.completed} / {progress.total}
				</span>
			</div>
			<div
				role="progressbar"
				aria-label="已完成占比"
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={progress.percent}
				className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-muted"
			>
				<div
					className="h-full bg-success"
					style={{ width: `${share(progress.completed)}%` }}
				/>
				<div
					className="h-full bg-primary"
					style={{ width: `${share(progress.in_progress)}%` }}
				/>
			</div>
			<dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
				{ROADMAP_STAGES.map((stage) => (
					<div key={stage} className="flex items-center gap-1.5">
						<StageDot stage={stage} />
						<dt className="text-muted-foreground">{ROADMAP_STAGE_LABELS[stage]}</dt>
						<dd className="font-mono tabular-nums">{progress[stage]}</dd>
					</div>
				))}
			</dl>
		</section>
	);
}
