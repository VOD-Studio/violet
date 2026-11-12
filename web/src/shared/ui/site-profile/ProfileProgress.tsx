export interface ProfileProgressProps {
	/** 已播时长，已格式化，如 "1:23"。 */
	elapsed: string;
	/** 总时长，已格式化；省略时只显示已播。 */
	total?: string;
	/** 已播比例 0–1；省略时没有轨道。 */
	ratio?: number;
}

/** 站长卡片里歌曲的进度行：已播、轨道、总时长。纯展示，走时由调用方驱动。 */
export function ProfileProgress({ elapsed, total, ratio }: ProfileProgressProps) {
	const percent = ratio === undefined ? null : Math.max(0, Math.min(100, ratio * 100));
	return (
		<div className="flex items-center gap-2 text-[11px] text-muted-foreground tabular-nums">
			<span>{elapsed}</span>
			{percent === null || total === undefined ? null : (
				<>
					<span
						role="progressbar"
						aria-label="播放进度"
						aria-valuemin={0}
						aria-valuemax={100}
						aria-valuenow={Math.round(percent)}
						className="h-0.75 flex-1 overflow-hidden rounded-xs bg-muted"
					>
						<span
							className="block h-full rounded-xs bg-decoration transition-[width] duration-1000 ease-linear motion-reduce:transition-none"
							style={{ width: `${percent}%` }}
						/>
					</span>
					<span>{total}</span>
				</>
			)}
		</div>
	);
}
