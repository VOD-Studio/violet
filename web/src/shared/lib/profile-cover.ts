/** 主页封面的统一规格：裁剪、预览与展示共用，保证所见即所得。 */

/** 裁剪选区宽高比（宽 ÷ 高）。 */
export const COVER_ASPECT = 3;

/** 上传前缩放的目标宽度（px）；超过则等比缩小，避免上传数 MB 的原图。 */
export const COVER_OUTPUT_WIDTH = 1920;

/** 选区像素宽度低于该值时提示分辨率偏低。 */
export const COVER_MIN_WIDTH = 1200;

/** 选区面积占原图比例低于该值时提示「这张图不太适合做横幅」。 */
export const COVER_MIN_SHARE = 0.35;

/**
 * 展示框的响应式比例：桌面与裁剪比例一致，窄屏逐级变高。
 * 窄屏按 cover 居中取景，所以重要内容应放在选区中部。
 */
export const COVER_FRAME_CLASS = "aspect-2/1 sm:aspect-5/2 lg:aspect-3/1";

/** 裁剪弹窗里并排展示的取景预览，与 COVER_FRAME_CLASS 的两端对应。 */
export const COVER_PREVIEWS = [
	{ label: "桌面", aspect: 3 },
	{ label: "手机", aspect: 2 },
] as const;
