/** 主题数据结构的版本；结构不兼容地变化时递增，旧版本数据回落为默认主题。 */
export const THEME_VERSION = 1;

/** 种子色以外的生成参数，每项都有默认值。 */
export interface Knobs {
	/**
	 * 中性色阶最高档的 OKLCH 色度，取值 0–0.05；不超过种子色本身的色度。
	 *
	 * @default 0.015
	 */
	neutralChroma: number;
}

/** 主题：一个种子色加若干旋钮。 */
export interface Theme {
	version: typeof THEME_VERSION;
	/** `#rrggbb` 或 `#rgb`，大小写不限 */
	seed: string;
	/** 省略的旋钮取默认值 */
	knobs?: Partial<Knobs>;
}

/** {@link normalizeTheme} 的结果：种子色为小写 `#rrggbb`，旋钮齐全。 */
export interface NormalizedTheme extends Theme {
	knobs: Knobs;
}

const DEFAULT_KNOBS: Knobs = { neutralChroma: 0.015 };
const KNOB_RANGES: Record<keyof Knobs, readonly [number, number]> = { neutralChroma: [0, 0.05] };
const DEFAULT_THEME: NormalizedTheme = {
	version: THEME_VERSION,
	seed: "#684dda",
	knobs: DEFAULT_KNOBS,
};
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** 合法时返回小写 `#rrggbb`，否则返回 null。 */
export function normalizeSeed(seed: unknown): string | null {
	if (typeof seed !== "string" || !HEX.test(seed)) return null;
	const digits = seed.slice(1).toLowerCase();
	return `#${digits.length === 3 ? [...digits].map((digit) => digit + digit).join("") : digits}`;
}

export function resolveKnobs(knobs: unknown): Knobs {
	const source = isRecord(knobs) ? knobs : {};
	const resolved = { ...DEFAULT_KNOBS };
	for (const name of Object.keys(DEFAULT_KNOBS) as (keyof Knobs)[]) {
		const value = source[name];
		const [min, max] = KNOB_RANGES[name];
		if (typeof value === "number" && Number.isFinite(value) && value >= min && value <= max)
			resolved[name] = value;
	}
	return resolved;
}

/**
 * 校验并规范化不可信的主题输入，例如从 Cookie 解析出的对象。
 *
 * 版本号不符、不是对象或种子色非法时整体回落为 `fallback`；单个旋钮非法或越界时只回落该旋钮，
 * 未知旋钮被丢弃。返回值只含规范化后的种子色与已知旋钮，可安全地拼进 CSS。
 *
 * @param fallback - 输入非法时返回的主题；省略时为种子色 `#684dda` 的包内主题
 * @returns 新对象，不与输入共享引用
 * @example
 * ```ts
 * normalizeTheme({ version: 1, seed: "#F0A" });
 * // { version: 1, seed: "#ff00aa", knobs: { neutralChroma: 0.015 } }
 * ```
 */
export function normalizeTheme(
	input: unknown,
	fallback: NormalizedTheme = DEFAULT_THEME,
): NormalizedTheme {
	const seed =
		isRecord(input) && input.version === THEME_VERSION ? normalizeSeed(input.seed) : null;
	if (!isRecord(input) || seed === null)
		return { version: THEME_VERSION, seed: fallback.seed, knobs: resolveKnobs(fallback.knobs) };
	return { version: THEME_VERSION, seed, knobs: resolveKnobs(input.knobs) };
}
