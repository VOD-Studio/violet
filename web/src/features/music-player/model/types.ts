/** 本站解析结果；地址短期有效，不持久化。 */
export interface MusicPlaybackDTO {
	id: string;
	/** 无可交付的完整播放地址时为 null。 */
	url: string | null;
	playable: boolean;
	/** true 表示上游仅给到试听片段，本站不交付。 */
	trial: boolean;
	format: string;
	/** bit/s。 */
	bitrate: number;
	/** 字节。 */
	size: number;
}

/** 公开播放的凭据模式；account 表示已按站点音乐账号权益解析。 */
export type MusicPlaybackMode = "account" | "anonymous";

export interface MusicPlaybackStatusDTO {
	mode: MusicPlaybackMode;
}

/** 原文、翻译与音译的原始 LRC；缺失内容为空字符串。 */
export interface MusicLyricDTO {
	lrc: string;
	translated: string;
	romanized: string;
}
