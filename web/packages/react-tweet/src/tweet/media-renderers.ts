import type { ReactNode } from "react";

import type { TweetPhoto, TweetVideo } from "../data/media.ts";

/**
 * 媒体展示扩展点。
 *
 * 回调仅接收净化后的地址；宿主负责自定义播放器、灯箱及其交互。
 */
export interface TweetMediaRenderers {
	/**
	 * 用宿主网格渲染一组连续的照片，保留原始媒体顺序。
	 *
	 * 默认提供可访问的原图链接网格，不拦截 portal 内部的键盘事件。
	 * @param photos - 保留原图地址与可选缩略图的连续照片组。
	 * @returns 宿主照片网格或灯箱入口。
	 */
	renderPhotos?: (photos: TweetPhoto[]) => ReactNode;
	/**
	 * 用宿主播放器或预览替换单项视频展示。
	 *
	 * 没有播放源的媒体只携带 thumbnailUrl，不能假定始终存在 url。
	 * @param media - 经过地址净化的视频或仅封面媒体。
	 * @returns 宿主视频播放器或原文预览入口。
	 */
	renderVideo?: (media: TweetVideo) => ReactNode;
}
