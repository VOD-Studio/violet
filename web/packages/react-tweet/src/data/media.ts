/**
 * 媒体共用的可选展示信息。
 *
 * 缺失尺寸不应阻止读取媒体内容。
 */
export interface TweetMediaMetadata {
	/**
	 * 来源媒体的像素宽度。
	 * @example 1200
	 */
	width?: number;
	/**
	 * 来源媒体的像素高度。
	 * @example 800
	 */
	height?: number;
	/**
	 * 来源提供的替代文字。
	 *
	 * 缺失时组件使用可本地化的媒体标签。
	 */
	alt?: string;
}

/**
 * 原图地址必需的照片。
 *
 * 原图与网格缩略图分离，宿主可以保留原图灯箱能力。
 */
export interface TweetPhoto extends TweetMediaMetadata {
	/**
	 * 照片判别值。
	 * @example "photo"
	 */
	kind: "photo";
	/**
	 * 用于原图预览或另页打开的地址。
	 * @example "https://pbs.twimg.com/media/example.jpg?name=orig"
	 */
	url: string;
	/**
	 * 仅用于网格展示的缩略图地址。
	 *
	 * 省略时网格直接展示原图。
	 */
	thumbnailUrl?: string;
}

/**
 * 原生播放器支持的视频种类。
 *
 * animated_gif 使用静音循环视频，不强制自动播放。
 */
export type TweetVideoKind = "video" | "animated_gif";

/**
 * 有真实播放源的视频或动图。
 *
 * 封面地址不能冒充播放源。
 */
export interface PlayableTweetVideo extends TweetMediaMetadata {
	/**
	 * 视频或动图判别值。
	 * @example "video"
	 */
	kind: TweetVideoKind;
	/**
	 * 真实可播放的媒体地址。
	 * @example "https://video.twimg.com/example.mp4"
	 */
	url: string;
	/**
	 * 播放器的可选封面。
	 *
	 * 播放失败时保留封面与原文链接。
	 */
	thumbnailUrl?: string;
}

/**
 * 只有封面的视频或动图。
 *
 * 展示封面与原文链接，不创建虚假的播放器。
 */
export interface TweetVideoPoster extends TweetMediaMetadata {
	/**
	 * 视频或动图判别值。
	 * @example "video"
	 */
	kind: TweetVideoKind;
	/**
	 * 缺少真实播放源时禁止填写 URL。
	 *
	 * 不能把封面地址复制到此字段。
	 */
	url?: never;
	/**
	 * 必需的封面地址。
	 * @example "https://pbs.twimg.com/example-poster.jpg"
	 */
	thumbnailUrl: string;
}

/**
 * 视频播放源与仅封面状态的联合。
 *
 * 至少一种真实媒体地址是必需的。
 */
export type TweetVideo = PlayableTweetVideo | TweetVideoPoster;

/**
 * 照片与视频媒体的判别联合。
 *
 * 使用 kind 区分照片和视频，再检查视频是否包含播放源。
 */
export type TweetMedia = TweetPhoto | TweetVideo;
