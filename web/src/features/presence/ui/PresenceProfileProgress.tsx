import { ProfileProgress } from "@shared/ui/site-profile";
import { useTickingNow } from "../hooks/use-ticking-now";
import { formatClock, mediaPosition } from "../lib/presence";
import type { PresenceDevice, PresenceMedia } from "../model/types";

/**
 * 站长卡片里的播放进度行：播放中每秒推进，暂停或速率未知时停表；位置未知时不渲染。
 */
export function PresenceProfileProgress({
	media,
	device,
	clockOffset,
}: {
	media: PresenceMedia;
	device: PresenceDevice;
	/** 服务端时钟减本机时钟（毫秒） */
	clockOffset: number;
}) {
	const advancing = media.state === "playing" && media.rate !== null;
	const now = useTickingNow(advancing);
	const position = mediaPosition(media, device, now + clockOffset);
	if (position === null) return null;
	const duration = media.duration_ms;

	return (
		<ProfileProgress
			elapsed={formatClock(position)}
			total={duration ? formatClock(duration) : undefined}
			ratio={duration ? Math.min(1, position / duration) : undefined}
		/>
	);
}
