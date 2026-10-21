/**
 * 零依赖轻量 QR Code 矩阵生成器（Byte 模式，支持 Level L/M/Q/H 与 Version 1-10）。
 *
 * 专门用于在无需第三方大依赖与原生绑定的情况下，直接在前端为网易云登录等 URL 生成 SVG 矩阵。
 */

type ErrorCorrectionLevel = "L" | "M" | "Q" | "H";

// 各版本在不同纠错等级下的容量与总码字数 (Version 1-10)
const ECC_CODEWORDS: Record<ErrorCorrectionLevel, number[]> = {
	L: [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18],
	M: [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26],
	Q: [0, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24],
	H: [0, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28],
};

const NUM_BLOCKS: Record<ErrorCorrectionLevel, number[]> = {
	L: [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4],
	M: [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5],
	Q: [0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8],
	H: [0, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8],
};

const TOTAL_CODEWORDS = [0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346];

// 对齐图案中心坐标表 (Version 1-10)
const ALIGNMENT_PATTERN_POSITIONS = [
	[],
	[],
	[6, 18],
	[6, 22],
	[6, 26],
	[6, 30],
	[6, 34],
	[6, 22, 38],
	[6, 24, 42],
	[6, 26, 46],
	[6, 28, 50],
];

// Galois Field (256) 运算表
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
	let x = 1;
	for (let i = 0; i < 255; i++) {
		GF_EXP[i] = x;
		GF_EXP[i + 255] = x;
		GF_LOG[x] = i;
		x <<= 1;
		if (x & 256) x ^= 0x11d;
	}
})();

function gfMul(x: number, y: number): number {
	if (x === 0 || y === 0) return 0;
	const logX = GF_LOG[x] ?? 0;
	const logY = GF_LOG[y] ?? 0;
	return GF_EXP[logX + logY] ?? 0;
}

// Reed-Solomon 生成多项式
function rsGeneratorPolynomial(degree: number): Uint8Array {
	let poly = new Uint8Array([1]);
	for (let i = 0; i < degree; i++) {
		const next = new Uint8Array(poly.length + 1);
		for (let j = 0; j < poly.length; j++) {
			next[j] ^= gfMul(poly[j] ?? 0, GF_EXP[i] ?? 0);
			next[j + 1] ^= poly[j] ?? 0;
		}
		poly = next;
	}
	return poly;
}

// 计算 Reed-Solomon 纠错码字
function rsCalculateRemainder(data: Uint8Array, degree: number): Uint8Array {
	const gen = rsGeneratorPolynomial(degree);
	const remainder = new Uint8Array(degree);
	for (const byte of data) {
		const factor = byte ^ (remainder[0] ?? 0);
		for (let i = 0; i < degree - 1; i++) {
			remainder[i] = (remainder[i + 1] ?? 0) ^ gfMul(gen[i + 1] ?? 0, factor);
		}
		remainder[degree - 1] = gfMul(gen[degree] ?? 0, factor);
	}
	return remainder;
}

/**
 * 自动选择适合文本长度的最小 QR 版本 (Version 1-10)。
 */
function pickVersion(dataLen: number, ecc: ErrorCorrectionLevel): number {
	for (let v = 1; v <= 10; v++) {
		const eccCount = (ECC_CODEWORDS[ecc][v] ?? 0) * (NUM_BLOCKS[ecc][v] ?? 0);
		const dataCap = (TOTAL_CODEWORDS[v] ?? 0) - eccCount;
		// Byte 模式开销: 4 位模式 + 8/16 位字符计数 (v1-9: 8 位)
		const charCountBits = v <= 9 ? 8 : 16;
		const capacity = Math.floor((dataCap * 8 - 4 - charCountBits) / 8);
		if (dataLen <= capacity) {
			return v;
		}
	}
	throw new Error(`文本过长，超过当前轻量编码器支持上限（支持最大约 200 字节）：${dataLen}`);
}

/**
 * 生成二维码布尔矩阵（true 表示黑点，false 表示白点）。
 */
export function generateQrMatrix(text: string, ecc: ErrorCorrectionLevel = "M"): boolean[][] {
	const bytes = new TextEncoder().encode(text);
	const version = pickVersion(bytes.length, ecc);
	const size = version * 4 + 17;

	// 1. 组装数据位流
	const bits: number[] = [];
	const pushBits = (value: number, count: number) => {
		for (let i = count - 1; i >= 0; i--) {
			bits.push((value >> i) & 1);
		}
	};

	// 模式指示符 (Byte = 0100)
	pushBits(0b0100, 4);
	// 字符计数
	pushBits(bytes.length, version <= 9 ? 8 : 16);
	// 数据本体
	for (const b of bytes) {
		pushBits(b, 8);
	}

	// 终止符与填充
	const eccCountPerBlock = ECC_CODEWORDS[ecc][version] ?? 0;
	const blockCount = NUM_BLOCKS[ecc][version] ?? 1;
	const totalDataCodewords = (TOTAL_CODEWORDS[version] ?? 0) - eccCountPerBlock * blockCount;
	const requiredBits = totalDataCodewords * 8;

	// 补终止符 0000（最多 4 位，不超限）
	const padCount = Math.min(4, requiredBits - bits.length);
	for (let i = 0; i < padCount; i++) bits.push(0);

	// 补齐到 8 位的倍数
	while (bits.length % 8 !== 0) bits.push(0);

	// 补填充字节 (0xEC, 0x11)
	const padBytes = [0xec, 0x11];
	let padIdx = 0;
	while (bits.length < requiredBits) {
		pushBits(padBytes[padIdx % 2] ?? 0, 8);
		padIdx++;
	}

	// 转字节码字
	const dataCodewords = new Uint8Array(totalDataCodewords);
	for (let i = 0; i < totalDataCodewords; i++) {
		let val = 0;
		for (let b = 0; b < 8; b++) {
			val = (val << 1) | (bits[i * 8 + b] ?? 0);
		}
		dataCodewords[i] = val;
	}

	// 2. 分块与 Reed-Solomon 纠错码字计算
	const shortBlockLen = Math.floor(totalDataCodewords / blockCount);
	const numLongBlocks = totalDataCodewords % blockCount;
	const blocks: Uint8Array[] = [];
	const eccBlocks: Uint8Array[] = [];
	let offset = 0;

	for (let i = 0; i < blockCount; i++) {
		const blockLen = i < blockCount - numLongBlocks ? shortBlockLen : shortBlockLen + 1;
		const blockData = dataCodewords.slice(offset, offset + blockLen);
		blocks.push(blockData);
		eccBlocks.push(rsCalculateRemainder(blockData, eccCountPerBlock));
		offset += blockLen;
	}

	// 3. 交叉交错重排
	const interleaved: number[] = [];
	const maxBlockLen = shortBlockLen + (numLongBlocks > 0 ? 1 : 0);
	for (let i = 0; i < maxBlockLen; i++) {
		for (const block of blocks) {
			if (i < block.length) interleaved.push(block[i] ?? 0);
		}
	}
	for (let i = 0; i < eccCountPerBlock; i++) {
		for (const eccBlock of eccBlocks) {
			interleaved.push(eccBlock[i] ?? 0);
		}
	}

	// 转换为交错位流
	const finalBits: number[] = [];
	for (const byte of interleaved) {
		for (let i = 7; i >= 0; i--) {
			finalBits.push((byte >> i) & 1);
		}
	}

	// 4. 构建矩阵与功能性图形
	const matrix: (boolean | null)[][] = Array.from({ length: size }, () =>
		Array.from({ length: size }, () => null),
	);

	// 寻标图案 (Finder pattern) 7x7
	const drawFinder = (startX: number, startY: number) => {
		for (let y = -1; y <= 7; y++) {
			for (let x = -1; x <= 7; x++) {
				const r = startY + y;
				const c = startX + x;
				if (r < 0 || r >= size || c < 0 || c >= size) continue;
				const isBorder = x === -1 || x === 7 || y === -1 || y === 7;
				const isOuterBox = x === 0 || x === 6 || y === 0 || y === 6;
				const isInnerBox = x >= 2 && x <= 4 && y >= 2 && y <= 4;
				const row = matrix[r];
				if (row) row[c] = !isBorder && (isOuterBox || isInnerBox);
			}
		}
	};

	drawFinder(0, 0);
	drawFinder(size - 7, 0);
	drawFinder(0, size - 7);

	// 定时图案 (Timing patterns)
	for (let i = 8; i < size - 8; i++) {
		const val = i % 2 === 0;
		const row6 = matrix[6];
		if (row6 && row6[i] === null) row6[i] = val;
		const rowI = matrix[i];
		if (rowI && rowI[6] === null) rowI[6] = val;
	}

	// 对齐图案 (Alignment patterns)
	const alignCoords = ALIGNMENT_PATTERN_POSITIONS[version] ?? [];
	for (const y of alignCoords) {
		for (const x of alignCoords) {
			if (matrix[y]?.[x] !== null) continue;
			for (let dy = -2; dy <= 2; dy++) {
				for (let dx = -2; dx <= 2; dx++) {
					const isBorder = Math.abs(dx) === 2 || Math.abs(dy) === 2;
					const isCenter = dx === 0 && dy === 0;
					const targetRow = matrix[y + dy];
					if (targetRow) targetRow[x + dx] = isBorder || isCenter;
				}
			}
		}
	}

	// 预留格式信息区 (Format info)
	for (let i = 0; i <= 8; i++) {
		const row8 = matrix[8];
		if (row8 && row8[i] === null) row8[i] = false;
		const rowI = matrix[i];
		if (rowI && rowI[8] === null) rowI[8] = false;
	}
	for (let i = size - 8; i < size; i++) {
		const row8 = matrix[8];
		if (row8 && row8[i] === null) row8[i] = false;
		const rowI = matrix[i];
		if (rowI && rowI[8] === null) rowI[8] = false;
	}
	// 暗模块 (Dark module)
	const darkRow = matrix[4 * version + 9];
	if (darkRow) darkRow[8] = true;

	// 5. 填入数据位流（从右至左两列一组，S型上下穿梭）
	let bitIdx = 0;
	let upward = true;
	for (let right = size - 1; right > 0; right -= 2) {
		// 跳过垂直定时线
		if (right === 6) right--;
		const rows = upward
			? Array.from({ length: size }, (_, i) => size - 1 - i)
			: Array.from({ length: size }, (_, i) => i);

		for (const y of rows) {
			for (const x of [right, right - 1]) {
				const targetRow = matrix[y];
				if (targetRow && targetRow[x] === null) {
					const bit = bitIdx < finalBits.length ? (finalBits[bitIdx] ?? 0) : 0;
					bitIdx++;
					// 应用标准掩码 0：(x + y) % 2 === 0
					targetRow[x] = (bit === 1) !== ((x + y) % 2 === 0);
				}
			}
		}
		upward = !upward;
	}

	// 6. 填入格式信息（ECC M + Mask 0 的 15 位 BCH 码：0x5412）
	// ECC 格式位: L: 01, M: 00, Q: 11, H: 10
	// 掩码 0: 000
	// 格式数据 = (00 << 3) | 000 = 0
	// 经 BCH(15,5) 与 0x5412 异或后，固定为 0x5412 (即 0101010000010010 二进制格式位)
	const FORMAT_INFO_M_MASK0 = 0x5412;
	for (let i = 0; i < 15; i++) {
		const bit = ((FORMAT_INFO_M_MASK0 >> i) & 1) === 1;
		const row8 = matrix[8];
		if (i <= 5) {
			if (row8) row8[i] = bit;
		} else if (i === 6) {
			if (row8) row8[7] = bit;
		} else if (i <= 8) {
			if (row8) row8[8] = bit;
		} else {
			const rowTarget = matrix[8 - (i - 8)];
			if (rowTarget) rowTarget[8] = bit;
		}

		if (i < 7) {
			const rowBottom = matrix[size - 1 - i];
			if (rowBottom) rowBottom[8] = bit;
		} else if (row8) {
			row8[size - 15 + i] = bit;
		}
	}

	return matrix.map((row) => row.map((cell) => cell ?? false));
}

/**
 * 将二维码矩阵转换为适合 SVG path 渲染的离散小方块路径。
 *
 * @param text 二维码文本
 * @param cellSize 单个模块像素大小，默认为 6
 * @param margin 外围静区格数，默认为 2
 */
export function generateQrSvgPath(
	text: string,
	cellSize = 6,
	margin = 2,
): { size: number; path: string } {
	const matrix = generateQrMatrix(text);
	const n = matrix.length;
	const totalSize = (n + margin * 2) * cellSize;
	let path = "";

	for (let r = 0; r < n; r++) {
		for (let c = 0; c < n; c++) {
			if (matrix[r]?.[c]) {
				const x = (c + margin) * cellSize;
				const y = (r + margin) * cellSize;
				path += `M${x},${y}h${cellSize}v${cellSize}h-${cellSize}z `;
			}
		}
	}

	return { size: totalSize, path: path.trim() };
}
