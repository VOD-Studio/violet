/**
 * 音频预览组件类型定义
 */

/** 音频播放器状态 */
export interface AudioPlayerState {
	/** 是否正在播放 */
	isPlaying: boolean;
	/** 是否就绪 */
	isReady: boolean;
	/** 当前时间（秒） */
	currentTime: number;
	/** 总时长（秒） */
	duration: number;
	/** 音量 0-1 */
	volume: number;
	/** 是否静音 */
	isMuted: boolean;
	/** 播放倍速 */
	playbackRate: number;
	/** 是否循环播放 */
	isLooping: boolean;
	/** 是否播放结束 */
	isEnded: boolean;
}

/** 加载状态 */
export type AudioLoadStatus = "loading" | "ready" | "error";

/** 可选倍速档位 */
export const AUDIO_PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

/** 音频预览组件属性 */
export interface AudioPreviewProps {
	/** 音频 URL */
	url: string;
	/** 音频 MIME 类型 */
	mimeType?: string;
	/** 音频标题 */
	name?: string;
	/** 自定义类名 */
	className?: string;
	/** 是否自动播放 */
	autoPlay?: boolean;
}
