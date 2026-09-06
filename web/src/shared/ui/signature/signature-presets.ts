/**
 * 站点作者手写签名笔画预置数据
 *
 * 遵循数据与渲染分离规范：所有名字的真实矢量笔画、viewBox 与书写时序
 * 集中在此文件统一定义。未来更换或新增手写签名，只需在此增改对应条目。
 */

export interface StrokeData {
	/** SVG 矢量笔画路径数据（M/C 曲线） */
	d: string;
	/** 运笔绘制时长（秒） */
	duration: number;
	/** 相对起笔延迟（秒） */
	delay: number;
	/** 笔划线宽，默认 3 */
	width?: number;
}

export interface SignaturePreset {
	/** 标识名字（全小写规范化） */
	name: string;
	/** SVG 视口尺寸 */
	viewBox: string;
	/** 原始参考宽度 */
	width: number;
	/** 原始参考高度 */
	height: number;
	/** 按真实书写笔顺排列的连续矢量笔画组 */
	strokes: StrokeData[];
}

/** 默认签名名字（当外部未传或匹配不到时回退） */
export const DEFAULT_SIGNATURE_NAME = "xunrua";

/**
 * 预置手写签名笔画配置表
 */
export const SIGNATURE_PRESETS: Record<string, SignaturePreset> = {
	xunrua: {
		name: "xunrua",
		viewBox: "0 0 380 110",
		width: 380,
		height: 110,
		strokes: [
			// 0: x 撇 (左上向右下轻撇)
			{ d: "M 32 44 C 38 52, 44 62, 52 70", duration: 0.16, delay: 0 },
			// 1: x 捺 (右上向左下切，底部顺滑引出连笔线进入 u)
			{
				d: "M 50 44 C 44 52, 36 64, 28 70 C 26 72, 34 74, 44 72 C 54 70, 60 58, 64 52",
				duration: 0.28,
				delay: 0.12,
			},
			// 2: u (顺势下切，圆润兜起，直落带出连线)
			{
				d: "M 64 52 C 66 58, 67 66, 72 69 C 77 71, 82 67, 84 54 C 85 60, 86 67, 90 70 C 94 72, 98 64, 102 52",
				duration: 0.32,
				delay: 0.36,
			},
			// 3: n (过第一拱落底，回弹过第二拱落底)
			{
				d: "M 102 52 C 105 47, 111 47, 114 53 C 116 59, 117 66, 119 70 C 122 62, 126 47, 133 48 C 138 49, 140 60, 142 70 C 145 64, 148 56, 154 50",
				duration: 0.36,
				delay: 0.65,
			},
			// 4: r (挑起过肩，微折落底)
			{
				d: "M 154 50 C 157 45, 163 44, 166 47 C 168 50, 168 56, 169 62 C 170 68, 172 71, 176 70 C 180 68, 184 58, 188 52",
				duration: 0.24,
				delay: 0.96,
			},
			// 5: u (重复 u 的圆润兜弧)
			{
				d: "M 188 52 C 190 58, 191 66, 196 69 C 201 71, 206 67, 208 54 C 209 60, 210 67, 214 70 C 218 72, 222 64, 226 52",
				duration: 0.32,
				delay: 1.16,
			},
			// 6: a (逆时针水滴状闭合圈)
			{
				d: "M 238 52 C 232 46, 222 50, 220 58 C 218 66, 225 71, 233 70 C 238 69, 243 62, 244 54",
				duration: 0.28,
				delay: 1.44,
			},
			// 7: a 收杆与贯穿签名波浪长甩尾 (垂直下落后不离纸，向右下方舒展飞白划出)
			{
				d: "M 244 54 C 244 60, 243 67, 246 70 C 250 74, 268 78, 295 76 C 322 74, 345 66, 365 68",
				duration: 0.46,
				delay: 1.7,
			},
		],
	},
	violet: {
		name: "violet",
		viewBox: "0 0 350 110",
		width: 350,
		height: 110,
		strokes: [
			// 0: V (大写花体起笔，向下大冲，大弧度挑出)
			{
				d: "M 30 38 C 36 32, 44 42, 42 54 C 40 64, 48 74, 54 74 C 60 74, 70 56, 76 34",
				duration: 0.35,
				delay: 0,
			},
			// 1: i (入笔下垂带勾)
			{
				d: "M 76 52 C 78 58, 79 66, 82 70 C 85 72, 88 66, 92 54",
				duration: 0.22,
				delay: 0.32,
			},
			// 2: o (椭圆环闭合)
			{
				d: "M 102 54 C 96 48, 88 54, 88 62 C 88 69, 96 72, 102 70 C 106 68, 108 60, 110 52",
				duration: 0.28,
				delay: 0.52,
			},
			// 3: l (修长回旋高环直冲云霄)
			{
				d: "M 110 52 C 114 40, 120 24, 124 22 C 127 21, 126 30, 124 44 C 122 58, 124 66, 126 70 C 128 72, 132 66, 136 54",
				duration: 0.38,
				delay: 0.78,
			},
			// 4: e (优雅小水滴 loop)
			{
				d: "M 136 62 C 138 52, 148 48, 150 56 C 151 63, 144 71, 138 70 C 142 72, 148 70, 154 54",
				duration: 0.22,
				delay: 1.12,
			},
			// 5: t + 贯穿签名长甩尾 (冲顶直落后，不离纸一气呵成划出波浪横线)
			{
				d: "M 154 54 C 158 48, 160 36, 162 34 C 163 34, 162 46, 162 60 C 162 68, 164 71, 168 70 C 174 68, 195 78, 230 76 C 265 74, 295 65, 320 68",
				duration: 0.45,
				delay: 1.32,
			},
			// 6: t 横杠 (飞白划过)
			{
				d: "M 152 46 C 158 45, 168 45, 174 46",
				duration: 0.15,
				delay: 1.74,
			},
			// 7: i 上的点 (小点精准点落)
			{
				d: "M 79 40 C 80 39, 81 39, 81 40",
				duration: 0.1,
				delay: 1.88,
				width: 4.2,
			},
		],
	},
};

/**
 * 根据名字解析匹配的签名预置数据，若未命中则回退默认预置
 */
export function getSignaturePreset(name?: string): SignaturePreset {
	if (!name) return SIGNATURE_PRESETS[DEFAULT_SIGNATURE_NAME];
	const key = name.trim().toLowerCase();
	return SIGNATURE_PRESETS[key] || SIGNATURE_PRESETS[DEFAULT_SIGNATURE_NAME];
}
