/**
 * 音频预览主组件（音乐播放器风格）
 *
 * 布局：封面图标 + 歌曲名 + 可拖拽进度条 + 精致控件（播放/音量/倍速/循环）。
 * 基于原生 <audio>，无波形依赖，加载/错误状态 + 重试，键盘快捷键。
 */

import { Disc3 } from "lucide-react";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import type { AudioPreviewProps } from "../types/audio-preview-types";
import { AudioControls } from "./AudioControls";
import { AudioOverlay } from "./AudioOverlay";

export function AudioPreview({ url, name, className, autoPlay = false }: AudioPreviewProps) {
	const player = useAudioPlayer({ url, autoPlay });
	const { state, loadStatus, audioRef } = player;

	return (
		<div
			ref={player.containerRef}
			className={`flex flex-col items-center gap-5 rounded-lg border bg-gradient-to-b from-card to-muted/30 p-8 focus:outline-none ${className ?? ""}`}
			tabIndex={0}
			role="region"
			aria-label={name ?? "音频预览"}
		>
			{/* 隐藏的 audio 元素 */}
			{/* biome-ignore lint/a11y/useMediaCaption: 内部素材预览，无字幕需求 */}
			<audio ref={audioRef} src={url} preload="metadata" className="hidden" />

			{/* 封面图标（带旋转动画） */}
			<div
				className={`flex size-32 items-center justify-center rounded-full bg-primary/10 shadow-inner ${state.isPlaying ? "animate-spin [animation-duration:6s]" : ""}`}
			>
				<Disc3 className="size-16 text-primary" />
			</div>

			{/* 歌曲名 */}
			{name ? (
				<p className="max-w-full truncate text-center text-base font-medium" title={name}>
					{name}
				</p>
			) : null}

			{/* 加载/错误态 */}
			{loadStatus !== "ready" ? (
				<AudioOverlay loadStatus={loadStatus} onRetry={player.retry} />
			) : (
				/* 控制栏 */
				<div className="w-full max-w-md">
					<AudioControls
						state={state}
						onTogglePlay={player.togglePlay}
						onSeek={player.seek}
						onSetVolume={player.setVolume}
						onToggleMute={player.toggleMute}
						onSetPlaybackRate={player.setPlaybackRate}
						onToggleLoop={player.toggleLoop}
					/>
				</div>
			)}
		</div>
	);
}
