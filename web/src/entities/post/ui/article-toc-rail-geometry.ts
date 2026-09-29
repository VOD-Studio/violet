export interface ArticleTocRailGeometry {
	bend: number;
	bendRange: number;
	path: string;
}

interface ArticleTocRailGeometryInput {
	activation: number;
	dynamicBend: number;
	height: number;
	progressY: number;
	reduced: boolean;
	timestamp: number;
}

const BASE_BEND = 10.4;
const BEND_WAVE = 0.6;
const BASE_BEND_RANGE = 56;

/** 轨迹强调色引用主色源 token：跟随配色预设与明暗模式，不写死色值。 */
export const ARTICLE_TOC_RAIL_ACCENT = "var(--primary-base)";
export const ARTICLE_TOC_RAIL_X = 8;

export function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

/** 计算单帧轨迹路径及其有效弯曲范围。 */
export function getArticleTocRailGeometry({
	activation,
	dynamicBend,
	height,
	progressY,
	reduced,
	timestamp,
}: ArticleTocRailGeometryInput): ArticleTocRailGeometry {
	const bendRange = BASE_BEND_RANGE + 2.2 * dynamicBend;
	const edgeFactor = clamp(
		Math.min(progressY / bendRange, (height - progressY) / bendRange),
		0,
		1,
	);
	const breathingBend = reduced
		? BASE_BEND
		: BASE_BEND + BEND_WAVE * Math.sin((timestamp / 9000) * Math.PI * 2);
	const bend = activation * (breathingBend + dynamicBend) * edgeFactor;
	const bendX = ARTICLE_TOC_RAIL_X + bend;
	const bendStart = Math.max(0, progressY - bendRange);
	const bendEnd = Math.min(height, progressY + bendRange);
	const path = `M${ARTICLE_TOC_RAIL_X} 0 L${ARTICLE_TOC_RAIL_X} ${bendStart} C${ARTICLE_TOC_RAIL_X} ${
		progressY - 0.45 * bendRange
	},${bendX} ${progressY - 0.3 * bendRange},${bendX} ${progressY} C${bendX} ${
		progressY + 0.3 * bendRange
	},${ARTICLE_TOC_RAIL_X} ${
		progressY + 0.45 * bendRange
	},${ARTICLE_TOC_RAIL_X} ${bendEnd} L${ARTICLE_TOC_RAIL_X} ${height}`;
	return { bend, bendRange, path };
}

/**
 * 计算 marker 应落在路径上的 x：按弯曲段贝塞尔的 y(t) 反解参数 t，
 * 再取 x(t)=ARTICLE_TOC_RAIL_X+bend·t²(3-2t)，保证点精确嵌在轨迹线上。
 * 之前的 cos² 衰减近似与贝塞尔 x(t) 系统性偏差，滚动加速时点会漂离曲线。
 */
export function getArticleTocRailMarkerX(
	markerY: number,
	progressY: number,
	bend: number,
	bendRange: number,
) {
	if (bend === 0 || bendRange <= 0) return ARTICLE_TOC_RAIL_X;
	const u = Math.abs(markerY - progressY) / bendRange;
	if (u >= 1) return ARTICLE_TOC_RAIL_X;

	// 弯曲段归一 y(t) = (1-t)³ + 0.45·3(1-t)²t + 0.3·3(1-t)t²（与路径 C 控制点一致），
	// u∈(0,1) 单调，二分求 t。
	const yOf = (t: number) =>
		(1 - t) ** 3 + 0.45 * 3 * (1 - t) ** 2 * t + 0.3 * 3 * (1 - t) * t * t;
	let lo = 0;
	let hi = 1;
	for (let i = 0; i < 12; i += 1) {
		const mid = (lo + hi) / 2;
		if (yOf(mid) > u) lo = mid;
		else hi = mid;
	}
	const t = (lo + hi) / 2;
	return ARTICLE_TOC_RAIL_X + bend * t * t * (3 - 2 * t);
}
