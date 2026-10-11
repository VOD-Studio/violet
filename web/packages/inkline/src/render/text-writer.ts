const encoder = /* @__PURE__ */ new TextEncoder();
const decoder = /* @__PURE__ */ new TextDecoder();

/**
 * 按字节拼接的文本缓冲区，最后一次解码为字符串。
 *
 * @remarks 大量坐标逐个转字符串再相加会产生海量短命字符串，垃圾回收占去大半序列化时间。
 */
export class TextWriter {
	private bytes: Uint8Array;
	private size = 0;
	private readonly decimals: number;
	private readonly scale: number;

	/**
	 * @param decimals - 坐标保留的小数位数
	 * @param capacity - 预估字节数，不足时自动扩容
	 */
	constructor(decimals: number, capacity = 1024) {
		this.bytes = new Uint8Array(Math.max(16, capacity));
		this.decimals = decimals;
		this.scale = 10 ** decimals;
	}

	private reserve(n: number): void {
		if (this.size + n <= this.bytes.length) return;
		const next = new Uint8Array(Math.max(this.bytes.length * 2, this.size + n));
		next.set(this.bytes.subarray(0, this.size));
		this.bytes = next;
	}

	/** 写入任意文本，按 UTF-8 编码。 */
	text(value: string): this {
		this.reserve(value.length * 3);
		const bytes = this.bytes;
		let at = this.size;
		for (let i = 0; i < value.length; i++) {
			const code = value.charCodeAt(i);
			if (code >= 0x80) {
				at = this.size + encoder.encodeInto(value, bytes.subarray(this.size)).written;
				break;
			}
			bytes[at++] = code;
		}
		this.size = at;
		return this;
	}

	/** 写入单个 ASCII 字符的编码。 */
	char(code: number): this {
		this.reserve(1);
		this.bytes[this.size++] = code;
		return this;
	}

	/** 按定点小数写入数字：去掉末尾的 0，舍入为 0 时写 "0"（不写 "-0"）。 */
	num(value: number): this {
		this.reserve(24);
		const bytes = this.bytes;
		const f = this.scale;
		let at = this.size;
		let k = Math.round(value * f);
		if (k < 0) {
			bytes[at++] = 45;
			k = -k;
		}
		let whole = Math.floor(k / f);
		let frac = k - whole * f;
		if (whole === 0) bytes[at++] = 48;
		else {
			let end = at;
			for (let q = whole; q > 0; q = Math.floor(q / 10)) end++;
			at = end;
			while (whole > 0) {
				const digit = whole % 10;
				bytes[--end] = 48 + digit;
				whole = (whole - digit) / 10;
			}
		}
		if (frac) {
			let digits = this.decimals;
			while (frac % 10 === 0) {
				frac /= 10;
				digits--;
			}
			bytes[at++] = 46;
			let end = at + digits;
			at = end;
			for (let i = 0; i < digits; i++) {
				const digit = frac % 10;
				bytes[--end] = 48 + digit;
				frac = (frac - digit) / 10;
			}
		}
		this.size = at;
		return this;
	}

	toString(): string {
		return decoder.decode(this.bytes.subarray(0, this.size));
	}
}
