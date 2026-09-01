export interface ImagePreviewProps {
	/** 是否显示预览 */
	open: boolean;
	/** 关闭回调 */
	onClose: () => void;
	/** 图片列表 */
	images: string[];
	/**
	 * 逐图替代文本（与 images 一一对应）。缺省回退「预览图片 n」。
	 * 图片本身有语义 alt（如画廊最终 alt text）时传入，读屏器才能读到真实描述。
	 */
	alts?: string[];
	/**
	 * 缩略图地址列表（与 images 一一对应；飞入动画用缩略图，原图加载完成后替换）。
	 * 后端缩略图为等比缩放（最大宽 300px），宽高比与原图一致，
	 * 用与原图相同的 contain 约束渲染即可自然重合，替换时无尺寸跳变。
	 * 不传或对应位为空 → 回退原图飞入（向后兼容）。
	 */
	thumbnails?: string[];
	/** 当前显示的图片索引 */
	currentIndex?: number;
	/** 索引变化回调 */
	onIndexChange?: (index: number) => void;
	/** 触发预览的原始图片元素（用于计算动画起点） */
	triggerElement?: HTMLElement | null;
	/**
	 * 触发元素的位置快照（打开时由调用方 getBoundingClientRect 快照）。
	 * 当触发元素在预览期间会被卸载时必须传入，否则关闭动画会读不到正确位置。
	 */
	triggerRect?: DOMRect | null;
	/** 退出动画播放完成回调（关闭动画结束后触发，调用方可据此清理数据） */
	onExitComplete?: () => void;
	/**
	 * 首图的原始尺寸（调用方已知原图 natural 尺寸时传入，如触发元素本身就是
	 * 已解码的原图 <img>）。传入后飞入盒直接按 natural 尺寸计算，跳过
	 * 「缩略图比例视口盒 → 原图加载后修正」的过渡，小图不会先放大再缩小。
	 */
	initialNaturalSize?: { w: number; h: number } | null;
}
