/**
 * 视频元信息展示条
 *
 * 在播放器下方展示分辨率、时长、体积、编码等信息（传入 metadata 时显示）。
 */

import { Clock, HardDrive, Hash, Monitor } from "lucide-react";
import type { VideoMetadata } from "../types/video-preview-types";
import { formatBytes, formatTime } from "../utils/format";

interface VideoInfoProps {
	metadata?: VideoMetadata;
	/** 当前实际播放时长（从视频读取，优先于 metadata.duration） */
	duration?: number;
}

export function VideoInfo({ metadata, duration }: VideoInfoProps) {
	if (!metadata) return null;

	const items: { icon: typeof Clock; label: string; value: string }[] = [];

	if (metadata.width && metadata.height) {
		items.push({
			icon: Monitor,
			label: "分辨率",
			value: `${metadata.width}×${metadata.height}`,
		});
	}

	const displayDuration = duration ?? metadata.duration;
	if (displayDuration !== undefined && displayDuration > 0) {
		items.push({ icon: Clock, label: "时长", value: formatTime(displayDuration) });
	}

	if (metadata.size !== undefined) {
		items.push({ icon: HardDrive, label: "体积", value: formatBytes(metadata.size) });
	}

	if (metadata.codec) {
		items.push({ icon: Hash, label: "编码", value: metadata.codec });
	}

	if (items.length === 0) return null;

	return (
		<div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/10 bg-black px-3 py-2 text-xs text-white/60">
			{items.map(({ icon: Icon, label, value }) => (
				<span key={label} className="flex items-center gap-1">
					<Icon className="size-3" />
					<span className="text-white/40">{label}:</span>
					<span className="font-medium text-white">{value}</span>
				</span>
			))}
		</div>
	);
}
