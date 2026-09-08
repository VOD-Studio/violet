/**
 * 全屏查看图片组。
 *
 * @remarks 鼠标拖动与触摸轻扫可循环切图，放大后拖动平移；滚轮缩放仅在图片区域响应。
 */
export interface ImagePreviewProps {
	open: boolean;
	onClose: () => void;
	images: string[];
	/** 与 images 一一对应的替代文本，缺省回退「预览图片 n」。 */
	alts?: string[];
	/**
	 * 与 images 一一对应的加载占位和底部导航图。
	 * 原图尺寸未知时不放大占位图；原图解码完成后替换。不传则显示加载指示器。
	 */
	thumbnails?: string[];
	currentIndex?: number;
	onIndexChange?: (index: number) => void;
	/** 触发预览的原始图片元素（用于计算动画起点） */
	triggerElement?: HTMLElement | null;
	/**
	 * 触发元素的位置快照，触发元素可能卸载时可传入。
	 * 仅用于本次打开的入场动画，不随切图复用。
	 */
	triggerRect?: DOMRect | null;
	/** 退出动画播放完成回调（关闭动画结束后触发，调用方可据此清理数据） */
	onExitComplete?: () => void;
	/**
	 * 本次打开的首图原始像素尺寸，可直接确定入场目标盒。
	 * 不传时读取原图尺寸，不从缩略图尺寸或 URL 参数推断。
	 */
	initialNaturalSize?: { w: number; h: number } | null;
}
