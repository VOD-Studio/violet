// 离线搜索分类色的色相与偏好亮度，结果手工写入 src/rules.ts 的 CATEGORICAL。
// 用法：node scripts/search-categorical.ts [色相最小间隔，默认 45]
// 亮度带取自各外观与档位下实色档的可行区间（前景文字达标、作为图形对背景 ≥3:1），宽度不超过 0.1 即近等亮度。
import { fitGamut, oklchToLinearRgb } from "../src/color.ts";

const COUNT = 6;
const CHROMA = 0.2;
const MIN_HUE_GAP = Number(process.argv[2] ?? 45);
const BANDS = {
	"light/standard": [0.451, 0.551],
	"light/more": [0.35, 0.449],
	"dark/standard": [0.788, 0.888],
	"dark/more": [0.873, 0.96],
} as const;
// Machado、Oliveira 与 Fernandes 2009 的二色视模拟矩阵（严重度 1.0），作用于线性 sRGB
const VISIONS = [
	[
		[1, 0, 0],
		[0, 1, 0],
		[0, 0, 1],
	],
	[
		[0.152286, 1.052583, -0.204868],
		[0.114503, 0.786281, 0.099216],
		[-0.003882, -0.048116, 1.051998],
	],
	[
		[0.367322, 0.860646, -0.227968],
		[0.280085, 0.672501, 0.047413],
		[-0.01182, 0.04294, 0.968881],
	],
	[
		[1.255528, -0.076749, -0.178779],
		[-0.078411, 0.930809, 0.147602],
		[0.004733, 0.691367, 0.3039],
	],
];

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const toOklab = ([r = 0, g = 0, b = 0]: number[]) => {
	const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
	const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
	const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
	return [
		0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
		1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
		0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
	];
};

interface Candidate {
	hues: number[];
	/** 每个亮度带一组，与 hues 一一对应 */
	lightness: number[][];
}

const bands = Object.values(BANDS);
const hueGap = (hues: number[]) => {
	let gap = 360;
	for (let i = 0; i < hues.length; i++)
		for (let j = i + 1; j < hues.length; j++) {
			const difference = Math.abs((hues[i] ?? 0) - (hues[j] ?? 0)) % 360;
			gap = Math.min(gap, difference, 360 - difference);
		}
	return gap;
};

/** 各亮度带、各视觉下两两最小 OKLab 色差。 */
const distances = ({ hues, lightness }: Candidate) =>
	bands.map((_, band) => {
		const rgb = hues.map((hue, index) =>
			oklchToLinearRgb(fitGamut(lightness[band]?.[index] ?? 0, CHROMA, hue, "srgb")).map(
				clamp,
			),
		);
		let minimum = Number.POSITIVE_INFINITY;
		for (const matrix of VISIONS) {
			const points = rgb.map((channels) =>
				toOklab(
					matrix.map((row) =>
						clamp(row.reduce((sum, weight, k) => sum + weight * (channels[k] ?? 0), 0)),
					),
				),
			);
			for (let i = 0; i < points.length; i++)
				for (let j = i + 1; j < points.length; j++)
					minimum = Math.min(
						minimum,
						Math.hypot(
							...(points[i] ?? []).map((value, k) => value - (points[j]?.[k] ?? 0)),
						),
					);
		}
		return minimum;
	});
const score = (candidate: Candidate) =>
	hueGap(candidate.hues) < MIN_HUE_GAP ? -1 : Math.min(...distances(candidate));

// 固定种子的线性同余随机数，结果可重复
let state = 11;
const random = () => {
	state = (state * 1103515245 + 12345) % 2147483648;
	return state / 2147483648;
};

let best: { score: number; candidate?: Candidate } = { score: -1 };
for (let restart = 0; restart < 80; restart++) {
	const offset = Math.floor(random() * 60);
	let candidate: Candidate = {
		hues: Array.from({ length: COUNT }, (_, index) => (offset + index * 60) % 360),
		lightness: bands.map(([low, high]) =>
			Array.from({ length: COUNT }, () => low + random() * (high - low)),
		),
	};
	let current = score(candidate);
	for (let iteration = 0; iteration < 1500; iteration++) {
		const trial: Candidate = {
			hues: [...candidate.hues],
			lightness: candidate.lightness.map((row) => [...row]),
		};
		const index = Math.floor(random() * COUNT);
		if (random() < 0.4)
			trial.hues[index] =
				((trial.hues[index] ?? 0) + Math.round((random() - 0.5) * 50) + 360) % 360;
		else {
			const band = Math.floor(random() * bands.length);
			const [low, high] = bands[band] ?? [0, 1];
			const row = trial.lightness[band] ?? [];
			row[index] =
				Math.round(
					Math.min(high, Math.max(low, (row[index] ?? low) + (random() - 0.5) * 0.06)) *
						1000,
				) / 1000;
		}
		const next = score(trial);
		if (next > current) {
			current = next;
			candidate = trial;
		}
	}
	if (current > best.score) best = { score: current, candidate };
}

const { candidate } = best;
if (!candidate) throw new Error("No candidate satisfies the hue gap");
console.log(
	`min ΔE_OK ${best.score.toFixed(4)}`,
	Object.keys(BANDS)
		.map((name, band) => `${name} ${distances(candidate)[band]?.toFixed(4)}`)
		.join(", "),
);
for (const index of candidate.hues
	.map((_, i) => i)
	.sort((a, b) => (candidate.hues[a] ?? 0) - (candidate.hues[b] ?? 0)))
	console.log(
		`  hue ${candidate.hues[index]}:`,
		Object.keys(BANDS)
			.map((name, band) => `${name} ${candidate.lightness[band]?.[index]?.toFixed(3)}`)
			.join(", "),
	);
