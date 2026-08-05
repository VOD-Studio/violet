/**
 * 归一化裁剪区域(相对原图,0~1)。
 *
 * 纯几何类型,归一化后与图片实际尺寸解耦,便于编码进 URL。
 * 定义在 shared 层供 ImageCropper/CroppedImage 与 features 层共享,
 * 依赖方向:features → shared(合法)。
 */
export interface CropRect {
	x: number;
	y: number;
	w: number;
	h: number;
}
