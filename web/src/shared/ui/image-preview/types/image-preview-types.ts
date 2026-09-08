/**
 * 全屏查看图片组。
 *
 * @remarks 鼠标拖动与触摸轻扫可循环切图，放大后拖动平移。
 * 滚轮手势从图片区域开始，仅控制逐渐收回与反向恢复；图片缩放使用工具栏或快捷键。
 */
export interface ImagePreviewProps {
	open: boolean;
	onClose: () => void;
	images: string[];
	/** 与 images 一一对应的替代文本，缺省回退「预览图片 n」。 */
	alts?: string[];
	/**
	 * 与 images 一一对应的加载占位和底部导航图。
	 * 原图尺寸未知时按触发图比例预留视口显示盒，解码完成后在同一几何盒内替换。
	 */
	thumbnails?: string[];
	currentIndex?: number;
	onIndexChange?: (index: number) => void;
	/** 触发预览的原始图片元素，用于计算入场与收回位置。 */
	triggerElement?: HTMLElement | null;
	/**
	 * 触发元素的位置快照，触发元素可能卸载时可传入。
	 * 用于首图入场；切图后优先收回到当前图片对应的页面元素。
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
