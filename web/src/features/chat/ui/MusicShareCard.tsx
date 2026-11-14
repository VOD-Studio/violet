import { Card, iconProps } from "@violet/ui";
import { Music2 } from "lucide-react";
import type { MusicShare } from "../model/types";

/** 展示消息中冻结的歌曲资料，不请求播放地址。 */
export function MusicShareCard({ song }: { song: MusicShare }) {
	const artists = song.artists.join(" / ") || "未知歌手";
	const seconds = Math.floor(song.duration_ms / 1000);
	const duration = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

	return (
		<Card
			aria-label={`歌曲：${song.title} - ${artists}`}
			className="w-70 max-w-full flex-row items-center gap-3 p-3 text-left"
			role="group"
		>
			{song.cover_url ? (
				<img
					alt=""
					className="size-11 shrink-0 rounded-lg object-cover"
					loading="lazy"
					src={song.cover_url}
				/>
			) : (
				<div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
					<Music2 {...iconProps(20)} />
				</div>
			)}
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm font-medium">{song.title}</p>
				<p className="truncate text-xs text-muted-foreground">
					{artists} · {duration}
				</p>
			</div>
		</Card>
	);
}
