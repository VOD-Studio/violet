/** 匿名解析结果；地址短期有效，不持久化。 */
export interface MusicPlaybackDTO {
	id: string;
	/** 无匿名播放地址时为 null。 */
	url: string | null;
	playable: boolean;
	format: string;
	/** bit/s。 */
	bitrate: number;
	/** 字节。 */
	size: number;
}

/** 原文、翻译与音译的原始 LRC；缺失内容为空字符串。 */
export interface MusicLyricDTO {
	lrc: string;
	translated: string;
	romanized: string;
}
