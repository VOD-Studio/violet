/**
 * 视频预览组件类型定义
 */

/** 视频播放器状态 */
export interface VideoPlayerState {
    /** 是否正在播放 */
    isPlaying: boolean;
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
    /** 是否处于等待/缓冲状态 */
    isWaiting: boolean;
    /** 是否已结束 */
    isEnded: boolean;
}

/** 加载状态 */
export type VideoLoadStatus = "loading" | "ready" | "error";

/** 可选倍速档位 */
export const PLAYBACK_RATES = [0.5, 1, 1.25, 1.5, 2] as const;

/** 视频预览组件属性 */
export interface VideoPreviewProps {
    /** 视频 URL */
    url: string;
    /** 视频 MIME 类型 */
    mimeType?: string;
    /** 视频标题（用于 aria-label） */
    name?: string;
    /** 视频元信息（分辨率/体积等，可选，不传则不显示信息区） */
    metadata?: VideoMetadata;
    /** 自定义类名 */
    className?: string;
    /** 是否自动播放（默认 false） */
    autoPlay?: boolean;
    /** 视频海报（封面，未播放时展示） */
    poster?: string;
}

/** 视频元信息 */
export interface VideoMetadata {
    /** 分辨率宽（px） */
    width?: number;
    /** 分辨率高（px） */
    height?: number;
    /** 文件大小（字节） */
    size?: number;
    /** 编码格式 */
    codec?: string;
    /** 时长（秒），不传则从视频读取 */
    duration?: number;
}
