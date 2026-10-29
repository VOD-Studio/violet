import { useTickingNow } from "../hooks/use-ticking-now";
import { formatClock, mediaPosition } from "../lib/presence";
import type { PresenceDevice, PresenceMedia } from "../model/types";

/**
 * 媒体进度条与时间；位置未知时不渲染，时长未知时只显示已播放时长。
 */
export function PresenceProgress({
	media,
	device,
	clockOffset,
}: {
	media: PresenceMedia;
	device: PresenceDevice;
	clockOffset: number;
}) {
	const advancing = media.state === "playing" && media.rate !== null;
	const now = useTickingNow(advancing);
	const position = mediaPosition(media, device, now + clockOffset);
	if (position === null) return null;
	const duration = media.duration_ms;
	const ratio = duration ? Math.min(1, position / duration) : null;

	return (
		<div className="mt-3">
			{ratio !== null ? (
				<div
					role="progressbar"
					aria-label="播放进度"
					aria-valuemin={0}
					aria-valuemax={duration ?? undefined}
					aria-valuenow={Math.round(position)}
					aria-valuetext={`${formatClock(position)} / ${formatClock(duration ?? 0)}`}
					className="h-1 overflow-hidden rounded-full bg-muted"
				>
					<div
						className="h-full rounded-full bg-foreground/70 transition-[width] duration-1000 ease-linear motion-reduce:transition-none"
						style={{ width: `${ratio * 100}%` }}
					/>
				</div>
			) : null}
			<div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground tabular-nums">
				<span>{formatClock(position)}</span>
				{duration ? <span>{formatClock(duration)}</span> : null}
			</div>
		</div>
	);
}
