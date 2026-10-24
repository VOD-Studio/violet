declare module "apca-w3" {
	/** 先文字后背景，传线性亮度 Y；返回带极性的 Lc。 */
	export function APCAcontrast(
		textY: number,
		backgroundY: number,
		places?: number,
	): number | string;
	/** 0–255 的 sRGB 通道，允许小数。 */
	export function sRGBtoY(rgb: readonly number[]): number;
}
