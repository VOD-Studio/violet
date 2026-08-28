/**
 * 等高行布局（Google Photos justified rows 的贪心实现，PRD-0022 详情网格选型）。
 *
 * 逐项累计宽高比，比例和达到饱和线（可用宽 / 目标行高）后封行；
 * 封行行高按「铺满行宽」反算（每行严格等高），最后一行不满时保持目标行高
 * 不拉伸（加 gap 后溢出才回缩），避免末行被拉成横幅。
 */

/** 参与布局的项：原始尺寸未知（null 或非正）按 1:1 兜底（视频元数据缺失的常见形态） */
export interface JustifySource {
	width: number | null;
	height: number | null;
}

/** 渲染后的项：index 回指源数组，w/h 为最终渲染尺寸（已扣除行内 gap 预算） */
export interface JustifyCell {
	index: number;
	w: number;
	h: number;
}

export interface JustifyRow {
	cells: JustifyCell[];
	/** 行高（该行所有 cell 的 h 相同） */
	h: number;
}

/**
 * 把源项切成等高行。
 *
 * @param items - 源项（width/height 为 null 时按 1:1 处理）
 * @returns 行数组；cell 的 w/h 已扣行内 gap 预算，可直接作渲染尺寸
 * @param containerWidth - 容器内容宽（px，需扣除容器 padding）
 * @param targetRowHeight - 目标行高（px）
 * @param gap - 行内项间横向间距（px；行间距由调用方布局另加）
 */
export function justifyRows(
	items: readonly JustifySource[],
	containerWidth: number,
	targetRowHeight: number,
	gap = 8,
): JustifyRow[] {
	if (items.length === 0 || containerWidth <= 0) return [];

	const aspectOf = (it: JustifySource) => {
		const w = it.width && it.width > 0 ? it.width : 1;
		const h = it.height && it.height > 0 ? it.height : 1;
		return w / h;
	};

	const saturation = containerWidth / targetRowHeight;
	const rows: JustifyRow[] = [];
	let row: { index: number; aspect: number }[] = [];
	let sum = 0;

	const flush = (stretch: boolean) => {
		if (row.length === 0) return;
		const gaps = gap * (row.length - 1);
		const budget = containerWidth - gaps;
		const h = stretch || sum * targetRowHeight > budget ? budget / sum : targetRowHeight;
		rows.push({
			cells: row.map((c) => ({ index: c.index, w: h * c.aspect, h })),
			h,
		});
		row = [];
		sum = 0;
	};

	for (let i = 0; i < items.length; i++) {
		const aspect = aspectOf(items[i]);
		row.push({ index: i, aspect });
		sum += aspect;
		if (sum >= saturation) {
			flush(true);
		}
	}
	flush(false);

	return rows;
}
