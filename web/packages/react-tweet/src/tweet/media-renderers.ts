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
	 * 接管照片的打开方式（如灯箱），保留默认的横向滚动或网格布局。
	 *
	 * 提供后，普通点击不再另页打开原图，而是调用本回调；按住修饰键或中键点击仍按链接打开。
	 * 同时提供 renderPhotos 时由 renderPhotos 全权负责，本回调不会被调用。
	 * @param photos - 被点击照片所在的连续照片组，保留原始顺序。
	 * @param index - 被点击照片在组内的序号。
	 * @param trigger - 被点击的链接元素，灯箱可据此做飞入动画并在关闭后还原焦点。
	 */
	onOpenPhoto?: (photos: TweetPhoto[], index: number, trigger: HTMLElement) => void;
	/**
	 * 用宿主播放器或预览替换单项视频展示。
	 *
	 * 没有播放源的媒体只携带 thumbnailUrl，不能假定始终存在 url。
	 * @param media - 经过地址净化的视频或仅封面媒体。
	 * @returns 宿主视频播放器或原文预览入口。
	 */
	renderVideo?: (media: TweetVideo) => ReactNode;
}
