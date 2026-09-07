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

export const ARTICLE_TOC_RAIL_ACCENT = "oklch(0.5279 0.1125 270.7)";
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

export function getArticleTocRailMarkerX(
	markerY: number,
	progressY: number,
	bend: number,
	bendRange: number,
) {
	const distance = Math.abs(markerY - progressY) / bendRange;
	const markerBend = distance >= 1 ? 0 : bend * Math.cos((distance * Math.PI) / 2) ** 2;
	return ARTICLE_TOC_RAIL_X + markerBend;
}
