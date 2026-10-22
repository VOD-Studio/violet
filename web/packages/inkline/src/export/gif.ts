import type { Rgb } from "./color-table.ts";

const TRANSPARENT = 255;

/** GIF 编码选项。 */
export interface GifEncoderOptions {
	width: number;
	height: number;
	/** 全局色表，至多 255 色。 */
	table: readonly Rgb[];
	/** true 为无限循环，数字为总播放次数。 */
	loop: true | number;
}

/**
 * GIF89a 编码器：全局色表，首帧整幅写入，之后每帧只写变化包围盒，盒内未变像素记为透明；
 * 连续相同的帧合并为一帧并累加延迟。
 */
export function createGifEncoder({ width, height, table, loop }: GifEncoderOptions) {
	const out = new ByteWriter();
	out.bytes([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
	out.u16(width);
	out.u16(height);
	// 带全局色表、8 位色深、表长 2^(7+1) = 256
	out.bytes([0xf7, 0, 0]);
	for (let i = 0; i < 256; i++) out.bytes(table[i] ?? [0, 0, 0]);
	if (loop !== 1) {
		out.bytes([
			0x21,
			0xff,
			0x0b,
			...[..."NETSCAPE2.0"].map((c) => c.charCodeAt(0)),
			0x03,
			0x01,
		]);
		// 循环计数是重播次数，0 表示无限
		out.u16(loop === true ? 0 : loop - 1);
		out.byte(0);
	}
	const lzw = createLzw(out);
	let previous: Uint8Array | null = null;
	let pending: Frame | null = null;

	const write = (frame: Frame) => {
		// 处置方式 1：保留本帧，下一帧叠在其上
		out.bytes([0x21, 0xf9, 0x04, (1 << 2) | (frame.transparent ? 1 : 0)]);
		out.u16(frame.delay);
		out.bytes([TRANSPARENT, 0, 0x2c]);
		out.u16(frame.x);
		out.u16(frame.y);
		out.u16(frame.w);
		out.u16(frame.h);
		out.byte(0);
		lzw(frame.data);
	};

	return {
		/** 追加一帧，indices 为整幅色表索引，delay 以 1/100 秒计。 */
		add(indices: Uint8Array, delay: number): void {
			let [x0, y0, x1, y1] = [0, 0, width - 1, height - 1];
			if (previous && pending) {
				[x0, y0, x1, y1] = [width, height, -1, -1];
				for (let y = 0, p = 0; y < height; y++)
					for (let x = 0; x < width; x++, p++)
						if (indices[p] !== previous[p]) {
							if (x < x0) x0 = x;
							if (x > x1) x1 = x;
							if (y < y0) y0 = y;
							if (y > y1) y1 = y;
						}
				if (x1 < 0) {
					pending.delay += delay;
					return;
				}
			}
			const w = x1 - x0 + 1;
			const h = y1 - y0 + 1;
			const data = new Uint8Array(w * h);
			for (let y = 0; y < h; y++)
				for (let x = 0; x < w; x++) {
					const p = (y + y0) * width + x + x0;
					data[y * w + x] =
						previous && indices[p] === previous[p] ? TRANSPARENT : indices[p];
				}
			if (pending) write(pending);
			pending = { x: x0, y: y0, w, h, data, delay, transparent: previous !== null };
			previous = indices.slice();
		},
		finish(): Uint8Array<ArrayBuffer> {
			if (pending) write(pending);
			out.byte(0x3b);
			return out.result();
		},
	};
}

interface Frame {
	x: number;
	y: number;
	w: number;
	h: number;
	data: Uint8Array;
	delay: number;
	transparent: boolean;
}

/** LZW 压缩并按 255 字节子块写出；码表键为 (前缀码 << 8 | 索引)，值带代次戳，清表只递增代次。 */
function createLzw(out: ByteWriter, minCodeSize = 8) {
	const codes = new Int32Array(1 << 20);
	let generation = 0;
	return (indices: Uint8Array): void => {
		out.byte(minCodeSize);
		const clear = 1 << minCodeSize;
		const end = clear + 1;
		let next = end + 1;
		let size = minCodeSize + 1;
		let bits = 0;
		let shift = 0;
		const block = new Uint8Array(255);
		let length = 0;
		const push = (byte: number) => {
			block[length++] = byte;
			if (length === 255) {
				out.byte(255);
				out.bytes(block);
				length = 0;
			}
		};
		const emit = (code: number) => {
			bits |= code << shift;
			shift += size;
			while (shift >= 8) {
				push(bits & 255);
				bits >>>= 8;
				shift -= 8;
			}
		};
		const reset = () => {
			// 代次用满 19 位后清零一次，免得旧代次的残留码被当成有效
			if (generation === 0x7ffff) {
				codes.fill(0);
				generation = 0;
			}
			generation++;
			return generation << 12;
		};
		let stamp = reset();
		emit(clear);
		let prefix = indices[0];
		for (let i = 1; i < indices.length; i++) {
			const k = indices[i];
			const key = (prefix << 8) | k;
			const entry = codes[key];
			if ((entry & ~0xfff) === stamp) {
				prefix = entry & 0xfff;
				continue;
			}
			emit(prefix);
			if (next === 4096) {
				emit(clear);
				next = end + 1;
				size = minCodeSize + 1;
				stamp = reset();
			} else {
				if (next >= 1 << size) size++;
				codes[key] = stamp | next++;
			}
			prefix = k;
		}
		emit(prefix);
		emit(end);
		if (shift > 0) push(bits & 255);
		if (length > 0) {
			out.byte(length);
			out.bytes(block.subarray(0, length));
		}
		out.byte(0);
	};
}

class ByteWriter {
	private buffer = new Uint8Array(1 << 16);
	private length = 0;

	byte(value: number): void {
		this.reserve(1);
		this.buffer[this.length++] = value;
	}

	u16(value: number): void {
		this.byte(value & 255);
		this.byte((value >> 8) & 255);
	}

	bytes(values: ArrayLike<number>): void {
		this.reserve(values.length);
		this.buffer.set(values, this.length);
		this.length += values.length;
	}

	result(): Uint8Array<ArrayBuffer> {
		return this.buffer.slice(0, this.length);
	}

	private reserve(n: number): void {
		if (this.length + n <= this.buffer.length) return;
		const next = new Uint8Array(Math.max(this.buffer.length * 2, this.length + n));
		next.set(this.buffer.subarray(0, this.length));
		this.buffer = next;
	}
}
