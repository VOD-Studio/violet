/** FNV-1a 32 位字符串哈希，用于把图元 id 与通道名换算为整数。 */
export function hashString(value: string): number {
	let h = 2166136261;
	for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
	return h >>> 0;
}

// PCG 哈希（Jarzynski & Olano, JCGT 2020），输入输出均为 uint32。
function pcg(v: number): number {
	const state = (Math.imul(v, 747796405) + 2891336453) | 0;
	const word = Math.imul((state >>> ((state >>> 28) + 4)) ^ state, 277803737);
	return ((word >>> 22) ^ word) >>> 0;
}

/**
 * 把通道名换算为随机通道编号；在扩展创建时调用一次，避免在热循环中哈希字符串。
 *
 * @example
 * ```ts
 * const WOBBLE = channel("my-pen:wobble");
 * const value = ctx.random(WOBBLE, i);
 * ```
 */
export function channel(name: string): number {
	return hashString(name);
}

/** 以 seed 与作用域派生的确定性随机源，结果与调用顺序无关。 */
export interface RandomSource {
	/** 返回 [0, 1) 的确定性值；index 须为整数。 */
	random(channel: number, index: number): number;
	/** 一维梯度噪声，连续且取值约在 [-1, 1]，整数格点处为 0。 */
	noise(channel: number, x: number): number;
	/** 派生互不相关的子作用域，如同一图元的描边与填充。 */
	scope(salt: number): RandomSource;
}

/** 创建以 seed 与作用域键为根的随机源。 */
export function createRandom(seed: number, key: number): RandomSource {
	const root = pcg((seed | 0) ^ pcg(key >>> 0));
	// 两轮 PCG：先把通道并入根，再与序号混合；序号相邻的输出仍互不相关。
	const random = (ch: number, index: number) =>
		pcg((pcg(root ^ ch) + Math.imul(index | 0, 0x9e3779b1)) | 0) / 4294967296;
	return {
		random,
		noise(ch, x) {
			const i = Math.floor(x);
			const f = x - i;
			const g0 = random(ch, i) * 2 - 1;
			const g1 = random(ch, i + 1) * 2 - 1;
			const u = f * f * f * (f * (f * 6 - 15) + 10);
			// 两端梯度贡献的理论峰值约为 0.5，乘 2 使取值接近 [-1, 1]。
			return 2 * (g0 * f + (g1 * (f - 1) - g0 * f) * u);
		},
		scope(salt) {
			return createRandom(seed, pcg(key ^ pcg(salt >>> 0)));
		},
	};
}
