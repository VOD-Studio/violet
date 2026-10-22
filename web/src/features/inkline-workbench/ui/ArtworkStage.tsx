import { Button } from "@violet/ui";
import { createPlayer, type Player } from "@violetjs/inkline";
import { mountSvg, seekSvg } from "@violetjs/inkline/svg";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useInkedArtwork } from "../hooks/useInkedArtwork";
import { useSiteTheme } from "../hooks/useSiteTheme";
import { phasedSchedule } from "../lib/artwork";
import { ARTWORKS } from "../model/artworks";
import { useWorkbenchStore } from "../model/workbench-store";
import { Timeline, type TimelineHandle } from "./Timeline";

const formatTime = (seconds: number) => `${seconds.toFixed(1)}s`;

/** 画稿舞台：带时间轴挂载画稿，播放器只管时间，播放头与时间文字逐帧直接更新。 */
export function ArtworkStage() {
	const key = useWorkbenchStore((s) => s.artwork);
	const mode = useWorkbenchStore((s) => s.mode);
	const rate = useWorkbenchStore((s) => s.rate);
	const artwork = useInkedArtwork(key);
	const theme = useSiteTheme();
	const schedule = useMemo(
		() => (artwork ? phasedSchedule(artwork.drawing, artwork.phases, mode) : null),
		[artwork, mode],
	);
	const host = useRef<HTMLDivElement>(null);
	const timeline = useRef<TimelineHandle>(null);
	const clock = useRef<HTMLSpanElement>(null);
	const player = useRef<Player | null>(null);
	const [playing, setPlaying] = useState(false);
	const label = ARTWORKS.find((a) => a.key === key)?.label ?? "";

	useEffect(() => {
		if (!artwork || !schedule || !host.current) return;
		const svg = mountSvg(artwork.drawing, artwork.palette, { schedule, title: label });
		svg.removeAttribute("style");
		svg.setAttribute("class", "block size-full");
		host.current.replaceChildren(svg);
		const total = formatTime(schedule.duration);
		const next = createPlayer({
			duration: schedule.duration,
			rate: useWorkbenchStore.getState().rate,
			onFrame: (time) => {
				seekSvg(svg, time);
				timeline.current?.setTime(time);
				if (clock.current) clock.current.textContent = `${formatTime(time)} / ${total}`;
			},
			onEnd: () => setPlaying(false),
		});
		player.current = next;
		next.play();
		setPlaying(true);
		return () => {
			next.cancel();
			svg.remove();
			player.current = null;
		};
	}, [artwork, schedule, label]);

	useEffect(() => {
		if (player.current) player.current.rate = rate;
	}, [rate]);

	// 主题切换后时间条以新 key 重建，把播放头放回当前时刻
	useEffect(() => {
		if (theme && player.current) timeline.current?.setTime(player.current.time);
	}, [theme]);

	// 播放中跳到结尾会被播放器当作「从头重播」，先暂停再跳
	const seek = (time: number) => {
		const current = player.current;
		if (!current || !schedule) return;
		if (time >= schedule.duration && current.playing) {
			current.pause();
			setPlaying(false);
		}
		current.seek(time);
	};

	const toggle = () => {
		const current = player.current;
		if (!current) return;
		if (current.playing) current.pause();
		else current.play();
		setPlaying(current.playing);
	};

	return (
		<div className="flex size-full min-h-0 flex-col gap-3">
			<div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-border bg-white">
				<div ref={host} className="absolute inset-4" />
				{!artwork && (
					<p className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
						正在生成画面…
					</p>
				)}
			</div>
			{schedule && artwork && (
				<div className="grid gap-2">
					<Timeline
						key={theme}
						ref={timeline}
						schedule={schedule}
						phases={artwork.phases}
						onSeek={seek}
					/>
					<div className="flex items-center gap-2">
						<Button variant="outline" size="sm" onClick={toggle}>
							{playing ? <Pause aria-hidden /> : <Play aria-hidden />}
							{playing ? "暂停" : "播放"}
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => {
								player.current?.restart();
								setPlaying(true);
							}}
						>
							<RotateCcw aria-hidden />
							重播
						</Button>
						<span
							ref={clock}
							className="ml-auto font-mono text-xs text-muted-foreground tabular-nums"
						>
							{`0.0s / ${formatTime(schedule.duration)}`}
						</span>
					</div>
				</div>
			)}
		</div>
	);
}
