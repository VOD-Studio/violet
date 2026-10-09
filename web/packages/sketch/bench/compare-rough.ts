// 用 PRD-0035 Rough.js 基线的同一组场景对照新库的生成与路径序列化耗时。
// 在 web/ 下运行：node packages/sketch/bench/compare-rough.ts
import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";
import {
	createPatternFill,
	type Drawing,
	draw,
	line,
	pathFromSvg,
	rect,
	type SceneItem,
	styles,
} from "../src/index.ts";
import { pathData } from "../src/render/svg.ts";

const require = createRequire(`${process.cwd()}/package.json`);
const rough = require("roughjs");
const g = rough.generator();
const recipe = {
	roughness: 2.2,
	maxRandomnessOffset: 2,
	bowing: 1.2,
	preserveVertices: true,
	disableMultiStroke: false,
	fillStyle: "solid",
	fillShapeRoughnessGain: 0,
	stroke: "#222",
	strokeWidth: 1.25,
};
const rounded = "M8 0H112A8 8 0 0 1 120 8V56A8 8 0 0 1 112 64H8A8 8 0 0 1 0 56V8A8 8 0 0 1 8 0Z";
let complex = "M0 0";
for (let j = 0; j < 128; j++)
	complex += `C${[j * 4 + 1, Math.sin(j) * 30, j * 4 + 3, Math.cos(j) * 30, j * 4 + 4, Math.sin(j + 1) * 30].join(" ")}`;

const natural = styles.natural;
const hachure = (gap: number) => ({ ...natural, fill: createPatternFill("hachure", { gap }) });

type Make = (i: number) => SceneItem;
const scenarios: [string, number, (i: number) => unknown, Make, typeof natural][] = [
	[
		"line",
		1000,
		(i) => g.line(0, 0, 120, 64, { ...recipe, seed: i + 1 }),
		(i) => ({ id: `${i}`, path: line(0, 0, 120, 64) }),
		natural,
	],
	[
		"rect solid",
		1000,
		(i) => g.rectangle(0, 0, 120, 64, { ...recipe, fill: "#ddd", seed: i + 1 }),
		(i) => ({ id: `${i}`, path: rect(0, 0, 120, 64), fillRole: "fill" }),
		natural,
	],
	[
		"rounded path solid",
		1000,
		(i) => g.path(rounded, { ...recipe, fill: "#ddd", seed: i + 1 }),
		(i) => ({ id: `${i}`, path: pathFromSvg(rounded), fillRole: "fill" }),
		natural,
	],
	[
		"rounded path stroke only",
		1000,
		(i) => g.path(rounded, { ...recipe, seed: i + 1 }),
		(i) => ({ id: `${i}`, path: pathFromSvg(rounded) }),
		natural,
	],
	[
		"rounded path stroke only / single",
		1000,
		(i) => g.path(rounded, { ...recipe, disableMultiStroke: true, seed: i + 1 }),
		(i) => ({ id: `${i}`, path: pathFromSvg(rounded) }),
		natural,
	],
	[
		"128-cubic path stroke only",
		100,
		(i) => g.path(complex, { ...recipe, seed: i + 1 }),
		(i) => ({ id: `${i}`, path: pathFromSvg(complex) }),
		natural,
	],
	[
		"rect hachure gap 4",
		100,
		(i) =>
			g.rectangle(0, 0, 120, 64, {
				...recipe,
				fill: "#ddd",
				fillStyle: "hachure",
				hachureGap: 4,
				seed: i + 1,
			}),
		(i) => ({ id: `${i}`, path: rect(0, 0, 120, 64), fillRole: "fill" }),
		hachure(4),
	],
	[
		"rect hachure gap 1",
		100,
		(i) =>
			g.rectangle(0, 0, 120, 64, {
				...recipe,
				fill: "#ddd",
				fillStyle: "hachure",
				hachureGap: 1,
				seed: i + 1,
			}),
		(i) => ({ id: `${i}`, path: rect(0, 0, 120, 64), fillRole: "fill" }),
		hachure(1),
	],
];

const SAMPLES = 21;
const WARMUP = 5;
const pct = (a: number[], p: number) => [...a].sort((x, y) => x - y)[Math.ceil(a.length * p) - 1];
const round = (v: number) => +v.toFixed(3);
let sink = 0;

function measure(run: () => number): { generate: number[]; serialize: number[]; chars: number } {
	const generate: number[] = [];
	const serialize: number[] = [];
	let chars = 0;
	for (let w = 0; w < WARMUP; w++) sink += run();
	for (let s = 0; s < SAMPLES; s++) {
		const t0 = performance.now();
		const out = lastBuild();
		generate.push(performance.now() - t0);
		const t1 = performance.now();
		chars = out();
		serialize.push(performance.now() - t1);
		sink += chars;
	}
	return { generate, serialize, chars };
}

// 生成与序列化分开计时：build 返回一个只做序列化的闭包。
let lastBuild: () => () => number = () => () => 0;

const results = [];
for (const [name, n, roughMake, sketchMake, style] of scenarios) {
	lastBuild = () => {
		const drawables = Array.from({ length: n }, (_, i) => roughMake(i));
		return () => {
			let b = 0;
			for (const d of drawables) for (const p of g.toPaths(d)) b += p.d.length;
			return b;
		};
	};
	const r = measure(() => lastBuild()());
	lastBuild = () => {
		const drawing: Drawing = draw(
			{ width: 600, height: 400, items: Array.from({ length: n }, (_, i) => sketchMake(i)) },
			{ style, width: 1.25, seed: 1 },
		);
		return () => {
			let b = 0;
			for (const item of drawing.items)
				for (const batch of item.batches) b += pathData(batch.verbs, batch.coords).length;
			return b;
		};
	};
	const k = measure(() => lastBuild()());
	results.push({
		name,
		shapes: n,
		rough: {
			generateMedianMs: round(pct(r.generate, 0.5)),
			generateP95Ms: round(pct(r.generate, 0.95)),
			serializeMedianMs: round(pct(r.serialize, 0.5)),
			serializeP95Ms: round(pct(r.serialize, 0.95)),
			pathCharsPerShape: Math.round(r.chars / n),
		},
		sketch: {
			generateMedianMs: round(pct(k.generate, 0.5)),
			generateP95Ms: round(pct(k.generate, 0.95)),
			serializeMedianMs: round(pct(k.serialize, 0.5)),
			serializeP95Ms: round(pct(k.serialize, 0.95)),
			pathCharsPerShape: Math.round(k.chars / n),
		},
	});
}
console.log(
	JSON.stringify(
		{
			runtime: process.version,
			rough: require("roughjs/package.json").version,
			platform: process.platform,
			arch: process.arch,
			samples: SAMPLES,
			warmupBatches: WARMUP,
			measurement: "Generation and SVG path data serialization only; no DOM, layout or paint",
			style: "sketch: natural hand + fineliner, width 1.25; rough: baseline recipe",
			results,
			sink,
		},
		null,
		2,
	),
);
