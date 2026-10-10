/** 首尾相接的生命游戏棋盘，cells 按行优先排列，1 为活细胞。 */
export interface LifeBoard {
	cols: number;
	rows: number;
	cells: Uint8Array;
}

/** 图案的活细胞坐标 [x, y]。 */
export type LifePattern = readonly (readonly [number, number])[];

/** 朝右下方滑行的滑翔机；四个方向由 stampPattern 的翻转参数得到。 */
export const GLIDER: LifePattern = [
	[1, 0],
	[2, 1],
	[0, 2],
	[1, 2],
	[2, 2],
];

export function createBoard(cols: number, rows: number): LifeBoard {
	return { cols, rows, cells: new Uint8Array(cols * rows) };
}

/** 演化一代：B3/S23，边缘首尾相接，滑翔机越出一侧会从对侧回来。 */
export function stepBoard({ cols, rows, cells }: LifeBoard): LifeBoard {
	const next = new Uint8Array(cells.length);
	for (let y = 0; y < rows; y++) {
		const up = ((y - 1 + rows) % rows) * cols;
		const mid = y * cols;
		const down = ((y + 1) % rows) * cols;
		for (let x = 0; x < cols; x++) {
			const left = (x - 1 + cols) % cols;
			const right = (x + 1) % cols;
			const neighbours =
				cells[up + left] +
				cells[up + x] +
				cells[up + right] +
				cells[mid + left] +
				cells[mid + right] +
				cells[down + left] +
				cells[down + x] +
				cells[down + right];
			next[mid + x] = neighbours === 3 || (neighbours === 2 && cells[mid + x]) ? 1 : 0;
		}
	}
	return { cols, rows, cells: next };
}

/** 换算视口尺寸后保留重叠区域的细胞，避免窗口缩放时图案整体重置。 */
export function resizeBoard(board: LifeBoard, cols: number, rows: number): LifeBoard {
	if (board.cols === cols && board.rows === rows) return board;
	const resized = createBoard(cols, rows);
	const keepCols = Math.min(cols, board.cols);
	for (let y = 0; y < Math.min(rows, board.rows); y++) {
		resized.cells.set(
			board.cells.subarray(y * board.cols, y * board.cols + keepCols),
			y * cols,
		);
	}
	return resized;
}

/** 在 (originX, originY) 处落下图案，坐标越界时绕回；flipX / flipY 改变滑翔方向。 */
export function stampPattern(
	cells: Uint8Array,
	cols: number,
	rows: number,
	pattern: LifePattern,
	originX: number,
	originY: number,
	flipX = false,
	flipY = false,
): void {
	for (const [px, py] of pattern) {
		const x = wrap(originX + (flipX ? -px : px), cols);
		const y = wrap(originY + (flipY ? -py : py), rows);
		cells[y * cols + x] = 1;
	}
}

function wrap(value: number, size: number): number {
	return ((value % size) + size) % size;
}

/**
 * 在右上与左下两角撒一片随机细胞汤，外缘逐渐稀疏。
 *
 * @param random - 返回 [0, 1) 的随机源
 */
export function seedCorners(board: LifeBoard, random: () => number): void {
	const { cols, rows, cells } = board;
	const reachX = Math.max(4, cols * 0.36);
	const reachY = Math.max(4, rows * 0.6);
	for (let y = 0; y < rows; y++) {
		for (let x = 0; x < cols; x++) {
			const fromTopRight = Math.hypot((cols - 1 - x) / reachX, y / reachY);
			const fromBottomLeft = Math.hypot(x / reachX, (rows - 1 - y) / reachY);
			const distance = Math.min(fromTopRight, fromBottomLeft);
			// 内圈密度约 0.4，随机汤能长时间演化；外缘线性收稀，免得边界像被裁切
			const density = 0.4 * Math.min(1, (1 - distance) * 2.5);
			if (distance < 1 && random() < density) cells[y * cols + x] = 1;
		}
	}
}

export function countAlive(cells: Uint8Array): number {
	let alive = 0;
	for (const cell of cells) alive += cell;
	return alive;
}
