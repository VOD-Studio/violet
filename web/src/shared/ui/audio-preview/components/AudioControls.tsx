/**
 * 音频控制栏（音乐播放器风格）
 *
 * 布局：左侧大圆形播放按钮 | 中间进度条+时间 | 右侧音量/倍速/循环
 * 进度条可点击/拖拽 seek，带缓冲指示。
 */

import { Pause, Play, Repeat, Repeat1, Volume1, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/shared/ui/base/button";
import { AUDIO_PLAYBACK_RATES, type AudioPlayerState } from "../types/audio-preview-types";
import { formatTime } from "../utils/format";

interface AudioControlsProps {
	state: AudioPlayerState;
	onTogglePlay: () => void;
	onSeek: (time: number) => void;
	onSetVolume: (volume: number) => void;
	onToggleMute: () => void;
	onSetPlaybackRate: (rate: number) => void;
	onToggleLoop: () => void;
}

export function AudioControls({
	state,
	onTogglePlay,
	onSeek,
	onSetVolume,
	onToggleMute,
	onSetPlaybackRate,
	onToggleLoop,
}: AudioControlsProps) {
	const [isDragging, setIsDragging] = useState(false);
	const [rateMenuOpen, setRateMenuOpen] = useState(false);
	const barRef = useRef<HTMLDivElement>(null);
	const rateRef = useRef<HTMLDivElement>(null);

	const progress = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;

	const getTimeFromEvent = (clientX: number): number => {
		const bar = barRef.current;
		if (!bar || state.duration === 0) return 0;
		const rect = bar.getBoundingClientRect();
		const ratio = Math.max(0, Math.min((clientX - rect.left) / rect.width, 1));
		return ratio * state.duration;
	};

	// 拖拽 seek
	// biome-ignore lint/correctness/useExhaustiveDependencies: onSeek/getTimeFromEvent 稳定引用，仅需响应拖拽与时长
	useEffect(() => {
		if (!isDragging) return;
		const onMove = (e: MouseEvent) => onSeek(getTimeFromEvent(e.clientX));
		const onUp = () => setIsDragging(false);
		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
		return () => {
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isDragging, state.duration]);

	// 倍速菜单点击外部关闭
	useEffect(() => {
		if (!rateMenuOpen) return;
		const handler = (e: MouseEvent) => {
			if (rateRef.current && !rateRef.current.contains(e.target as Node)) {
				setRateMenuOpen(false);
			}
		};
		const timer = setTimeout(() => document.addEventListener("click", handler), 0);
		return () => {
			clearTimeout(timer);
			document.removeEventListener("click", handler);
		};
	}, [rateMenuOpen]);

	const VolumeIcon =
		state.isMuted || state.volume === 0 ? VolumeX : state.volume < 0.5 ? Volume1 : Volume2;

	return (
		<div className="flex w-full items-center gap-4">
			{/* 主播放按钮（大圆形） */}
			<button
				type="button"
				onClick={onTogglePlay}
				className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform hover:scale-105 active:scale-95"
				title={state.isPlaying ? "暂停 (空格)" : "播放 (空格)"}
			>
				{state.isPlaying ? (
					<Pause className="size-5 fill-current" />
				) : (
					<Play className="ml-0.5 size-5 fill-current" />
				)}
			</button>

			{/* 进度区 */}
			<div className="flex min-w-0 flex-1 items-center gap-3">
				<span className="shrink-0 text-xs tabular-nums text-muted-foreground">
					{formatTime(state.currentTime)}
				</span>

				{/* 进度条 */}
				<div
					ref={barRef}
					role="slider"
					tabIndex={0}
					aria-label="播放进度"
					aria-valuemin={0}
					aria-valuemax={Math.floor(state.duration)}
					aria-valuenow={Math.floor(state.currentTime)}
					className="group/progress relative flex h-4 flex-1 cursor-pointer items-center"
					onClick={(e) => onSeek(getTimeFromEvent(e.clientX))}
					onKeyDown={(e) => {
						if (e.key === "ArrowLeft") {
							e.preventDefault();
							onSeek(state.currentTime - 5);
						} else if (e.key === "ArrowRight") {
							e.preventDefault();
							onSeek(state.currentTime + 5);
						}
					}}
					onMouseDown={(e) => {
						setIsDragging(true);
						onSeek(getTimeFromEvent(e.clientX));
					}}
				>
					<div className="relative h-1 w-full rounded-full bg-muted transition-all group-hover/progress:h-1.5">
						{/* 已播放 */}
						<div
							className="absolute inset-y-0 left-0 rounded-full bg-primary"
							style={{ width: `${progress}%` }}
						/>
						{/* 手柄 */}
						<div
							className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary opacity-0 shadow transition-opacity group-hover/progress:opacity-100"
							style={{ left: `${progress}%` }}
						/>
					</div>
				</div>

				<span className="shrink-0 text-xs tabular-nums text-muted-foreground">
					{formatTime(state.duration)}
				</span>
			</div>

			{/* 右侧：音量、倍速、循环 */}
			<div className="flex shrink-0 items-center gap-1">
				{/* 音量 */}
				<div className="group/volume flex items-center">
					<Button
						type="button"
						size="icon-sm"
						variant="ghost"
						onClick={onToggleMute}
						title="静音 (M)"
					>
						<VolumeIcon className="size-4" />
					</Button>
					<input
						type="range"
						min={0}
						max={1}
						step={0.05}
						value={state.isMuted ? 0 : state.volume}
						onChange={(e) => onSetVolume(Number(e.target.value))}
						className="h-1 w-0 cursor-pointer appearance-none rounded-full bg-muted accent-primary opacity-0 transition-all group-hover/volume:w-14 group-hover/volume:opacity-100"
						aria-label="音量"
					/>
				</div>

				{/* 倍速 */}
				<div ref={rateRef} className="relative">
					<Button
						type="button"
						size="sm"
						variant="ghost"
						className="text-xs"
						title="倍速"
						onClick={() => setRateMenuOpen((prev) => !prev)}
					>
						{state.playbackRate}x
					</Button>
					{rateMenuOpen ? (
						<div className="absolute bottom-full right-0 z-50 mb-1 flex flex-col rounded-md border bg-popover py-1 shadow-md">
							{AUDIO_PLAYBACK_RATES.map((rate) => (
								<button
									type="button"
									key={rate}
									className={`flex min-w-16 items-center justify-between gap-2 px-3 py-1 text-left text-xs hover:bg-muted ${rate === state.playbackRate ? "font-medium text-primary" : "text-muted-foreground"}`}
									onClick={() => {
										onSetPlaybackRate(rate);
										setRateMenuOpen(false);
									}}
								>
									<span>{rate === 1 ? "正常" : `${rate}x`}</span>
									{rate === state.playbackRate ? <span>✓</span> : null}
								</button>
							))}
						</div>
					) : null}
				</div>

				{/* 循环 */}
				<Button
					type="button"
					size="icon-sm"
					variant={state.isLooping ? "secondary" : "ghost"}
					onClick={onToggleLoop}
					title={state.isLooping ? "关闭循环" : "单曲循环"}
				>
					{state.isLooping ? (
						<Repeat1 className="size-4 text-primary" />
					) : (
						<Repeat className="size-4" />
					)}
				</Button>
			</div>
		</div>
	);
}
