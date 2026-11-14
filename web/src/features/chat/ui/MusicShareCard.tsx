import { Button, iconProps } from "@violet/ui";
import { getPlayer } from "@violetjs/kite-player";
import { Music2, Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";
import type { MusicShare } from "../model/types";

/** 消息资料使用发送时的快照；播放通过站点唯一播放器按需解析当前权限。 */
export function MusicShareCard({ song }: { song: MusicShare }) {
	const [playing, setPlaying] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	useEffect(() => {
		const player = getPlayer({ storageKey: "violet:music-player" });
		const update = () => {
			const current = player.state.current?.id === song.track_id;
			setPlaying(current && player.state.playing);
			if (current && player.state.error) {
				setError(player.state.error.message);
			}
		};
		update();
		return player.subscribe(update);
	}, [song.track_id]);
	const toggle = async () => {
		const player = getPlayer({ storageKey: "violet:music-player" });
		setError("");
		if (!player.hasSource()) {
			setError("播放器尚未就绪，请稍后重试");
			return;
		}
		if (player.state.current?.id === song.track_id && player.state.playing) {
			player.pause();
			return;
		}
		setLoading(true);
		try {
			await player.playTrack(song.track_id);
			if (player.state.error) {
				setError(player.state.error.message);
			}
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : "歌曲暂时无法播放");
		} finally {
			setLoading(false);
		}
	};
	const artists = song.artists.join(" / ") || "未知歌手";
	const seconds = Math.floor(song.duration_ms / 1000);
	const duration = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
	return (
		<div
			role="group"
			aria-label={`歌曲：${song.title} - ${artists}`}
			className="w-70 max-w-full rounded-xl bg-secondary p-2 text-left"
		>
			<div className="flex items-center gap-2.5">
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
					<p className="truncate text-[13px] font-medium">{song.title}</p>
					<p className="truncate text-[11px] text-muted-foreground">
						{artists} · {duration}
					</p>
				</div>
				<Button
					iconOnly
					size="sm"
					variant="ghost"
					className="size-8 shrink-0 rounded-full bg-card"
					aria-label={`${playing ? "暂停" : "播放"} ${song.title}`}
					aria-pressed={playing}
					loading={loading}
					onClick={() => void toggle()}
				>
					{playing ? <Pause {...iconProps(14)} /> : <Play {...iconProps(14)} />}
				</Button>
			</div>
			{error && (
				<p role="alert" className="mt-2 text-xs text-destructive">
					{error}
				</p>
			)}
		</div>
	);
}
