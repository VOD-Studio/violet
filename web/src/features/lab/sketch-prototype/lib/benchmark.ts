import { renderRoughScene } from "@features/lab/sketch-prototype/lib/rough";
import { comicScene } from "@features/lab/sketch-prototype/model/comic-scene";
import {
	defaultPalette,
	holeScene,
	loadMermaidScene,
	makeStressScene,
} from "@features/lab/sketch-prototype/model/scenes";
import type { Variant } from "@features/lab/sketch-prototype/model/variants";
import type { Command, DrawnScene, Scene } from "@violet/sketch";
import {
	BudgetExceeded,
	drawCanvas,
	generateScene,
	geometryFromCommands,
	mountSvg,
	updateSvgProgress,
} from "@violet/sketch";

export interface BenchmarkRow {
	scenario: string;
	stage: string;
	medianMs: number;
	p95Ms: number;
	commands: number | "—";
	samples: number | "—";
	bytes: number | "—";
	nodes: number | "—";
	note: string;
}

/** 计时覆盖实际生成、矢量构造、提交与 rAF；不把提交完成当作 GPU 呈现完成。 */
export async function runBenchmarks(variant: Variant): Promise<BenchmarkRow[]> {
	const rows: BenchmarkRow[] = [];
	const measurements: { scenario: string; stage: string; ms: number[] }[] = [];
	const options = {
		seed: 35,
		width: 2.2,
		precision: 0.3,
		maxCommands: 600000,
		maxSamples: 200000,
	};
	const pen = variant.createPen();
	const overlay = document.createElement("div");
	overlay.style.cssText =
		"position:fixed;left:0;top:0;width:800px;height:600px;max-width:100vw;max-height:100vh;overflow:hidden;z-index:2147483000;pointer-events:none";
	overlay.setAttribute("aria-label", "基准实际提交画面");
	document.body.append(overlay);
	const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));
	const record = (
		scenario: string,
		stage: string,
		values: number[],
		drawn: DrawnScene | null,
		note: string,
		bytes: number | "—" = "—",
		nodes: number | "—" = "—",
	) => {
		const sorted = [...values].sort((a, b) => a - b);
		rows.push({
			scenario,
			stage,
			medianMs: sorted[Math.floor(sorted.length * 0.5)],
			p95Ms: sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)],
			commands: drawn?.commands ?? "—",
			samples: drawn?.samples ?? "—",
			bytes,
			nodes,
			note,
		});
		measurements.push({ scenario, stage, ms: values });
	};
	try {
		const layoutCases: { name: string; scene: Scene }[] = [];
		for (const nodes of [24, 100]) {
			const start = performance.now();
			const scene = await loadMermaidScene(nodes);
			record(
				`Mermaid ${nodes}`,
				"layout + sanitize + extraction",
				[performance.now() - start],
				null,
				"单次；真实 Mermaid、字体、净化和 DOM 提取，不计入笔迹生成",
				"—",
				scene.items.length,
			);
			layoutCases.push({ name: `Mermaid ${nodes}`, scene });
		}
		const complex: Command[] = [{ op: "M", values: [45, 280] }];
		for (let i = 0; i < 32; i++) {
			const x = 45 + i * 26,
				y = i % 2 ? 340 : 280;
			complex.push({
				op: "C",
				values: [x + 7, y - 90, x + 18, y + 100, x + 26, i % 2 ? 280 : 340],
			});
		}
		const cases = [
			...layoutCases,
			{
				name: "complex / 32 cubic",
				scene: {
					width: 960,
					height: 620,
					items: [{ id: "complex-cubic", geometry: geometryFromCommands(complex) }],
				},
			},
			{ name: "compound / hole rules", scene: holeScene },
			{ name: "color comic", scene: comicScene },
		];
		for (const fixture of cases) {
			await nextFrame();
			const scene: Scene = {
				...fixture.scene,
				items: fixture.scene.items.map((item) => ({
					...item,
					geometry: geometryFromCommands(item.geometry.commands, item.geometry.fillRule),
				})),
			};
			let drawn: DrawnScene;
			let start = performance.now();
			try {
				drawn = generateScene(scene, pen, options);
			} catch (error) {
				record(
					fixture.name,
					"generate / explicit failure",
					[performance.now() - start],
					null,
					`${error instanceof Error ? error.message : String(error)}；未返回部分图像`,
				);
				continue;
			}
			record(
				fixture.name,
				"generate / cold geometry",
				[performance.now() - start],
				drawn,
				"单次冷几何；不包含输入解析和 Mermaid 布局",
			);
			const warm: number[] = [];
			for (let i = 0; i < 7; i++) {
				start = performance.now();
				generateScene(scene, pen, options);
				warm.push(performance.now() - start);
			}
			record(
				fixture.name,
				"generate / warm",
				warm,
				drawn,
				"7 次；几何采样缓存已热，笔墨仍重新生成",
			);
			const builds: number[] = [];
			let svg = mountSvg(drawn, defaultPalette);
			for (let i = 0; i < 7; i++) {
				start = performance.now();
				svg = mountSvg(drawn, defaultPalette);
				builds.push(performance.now() - start);
			}
			const svgNodes = svg.querySelectorAll("*").length;
			record(
				fixture.name,
				"SVG build / detached",
				builds,
				drawn,
				"7 次；未提交 DOM，未包含布局或绘制",
				"—",
				svgNodes,
			);
			const serialize: number[] = [];
			let serialized = "";
			for (let i = 0; i < 7; i++) {
				start = performance.now();
				serialized = new XMLSerializer().serializeToString(svg);
				serialize.push(performance.now() - start);
			}
			const svgBytes = new TextEncoder().encode(serialized).length;
			record(
				fixture.name,
				"SVG serialize",
				serialize,
				drawn,
				"7 次；独立 SVG 的实际 UTF-8 字节",
				svgBytes,
				svgNodes,
			);
			const commits: number[] = [];
			for (let i = 0; i < 5; i++) {
				const next = mountSvg(drawn, defaultPalette);
				start = performance.now();
				overlay.replaceChildren(next);
				next.getBoundingClientRect();
				await nextFrame();
				commits.push(performance.now() - start);
				svg = next;
			}
			record(
				fixture.name,
				"SVG commit → next rAF",
				commits,
				drawn,
				"5 次；包含提交和布局等待，不是像素呈现确认",
				svgBytes,
				svgNodes,
			);
			const intervals: number[] = [];
			let previous = await nextFrame();
			for (let i = 0; i < 60; i++) {
				updateSvgProgress(svg, drawn, i / 59, false);
				const now = await nextFrame();
				intervals.push(now - previous);
				previous = now;
			}
			updateSvgProgress(svg, drawn, 1, false);
			record(
				fixture.name,
				"SVG timeline / rAF interval",
				intervals,
				drawn,
				"60 次并行显现；回调间隔，不证明每帧已经实际呈现",
				svgBytes,
				svgNodes,
			);
			const canvas = document.createElement("canvas");
			canvas.style.cssText =
				"width:800px;height:600px;max-width:100%;max-height:100%;display:block";
			overlay.replaceChildren(canvas);
			const coldCanvas: number[] = [],
				hotCanvas: number[] = [];
			for (let i = 0; i < 7; i++) {
				start = performance.now();
				drawCanvas({ ...drawn }, canvas, defaultPalette);
				coldCanvas.push(performance.now() - start);
			}
			drawCanvas(drawn, canvas, defaultPalette);
			for (let i = 0; i < 7; i++) {
				start = performance.now();
				drawCanvas(drawn, canvas, defaultPalette);
				hotCanvas.push(performance.now() - start);
			}
			record(
				fixture.name,
				"Canvas cold Path2D / submit",
				coldCanvas,
				drawn,
				"7 次；800×600 CSS px，DPR 为当前设备；调用返回不是 GPU 完成",
			);
			record(
				fixture.name,
				"Canvas hot Path2D / submit",
				hotCanvas,
				drawn,
				"7 次；缓存 Path2D，包含清屏及完整提交，不含呈现确认",
			);
			const canvasIntervals: number[] = [],
				frameSubmissions: number[] = [];
			previous = await nextFrame();
			for (let i = 0; i < 60; i++) {
				start = performance.now();
				drawCanvas(drawn, canvas, defaultPalette, i / 59, false);
				frameSubmissions.push(performance.now() - start);
				const now = await nextFrame();
				canvasIntervals.push(now - previous);
				previous = now;
			}
			record(
				fixture.name,
				"Canvas timeline / submit",
				frameSubmissions,
				drawn,
				"60 次并行显现；包含骨架裁剪，不重生成笔墨；不等同于呈现完成",
			);
			record(
				fixture.name,
				"Canvas timeline / rAF interval",
				canvasIntervals,
				drawn,
				"60 次；真实更新后的回调间隔，非 GPU 呈现完成确认",
			);
			const roughValues: number[] = [];
			let roughSvg = renderRoughScene(scene, defaultPalette, "solid", options);
			for (let i = 0; i < 7; i++) {
				start = performance.now();
				roughSvg = renderRoughScene(scene, defaultPalette, "solid", options);
				roughValues.push(performance.now() - start);
			}
			record(
				fixture.name,
				"Rough generate + SVG build",
				roughValues,
				null,
				"7 次；同骨架和配色，原生算法；与新库 generate+build 比较，非压感/孔洞/笔墨质量等价",
				new TextEncoder().encode(new XMLSerializer().serializeToString(roughSvg)).length,
				roughSvg.querySelectorAll("*").length,
			);
		}
		const stress = makeStressScene(30000);
		const stressStart = performance.now();
		try {
			const drawn = generateScene(stress, pen, options);
			record(
				"grid / 30000 nodes",
				"generate / completed",
				[performance.now() - stressStart],
				drawn,
				"实际完成生成；没有假定此笔迹必然超限，未提交巨大图像",
			);
		} catch (error) {
			record(
				"grid / 30000 nodes",
				"generate / budget rejection",
				[performance.now() - stressStart],
				null,
				error instanceof Error ? error.message : String(error),
			);
			if (error instanceof BudgetExceeded) {
				const row = rows[rows.length - 1];
				if (error.kind === "commands") row.commands = error.actual;
				else row.samples = error.actual;
			}
		}
		Object.defineProperty(window, "sketchBenchmarkResult", {
			configurable: true,
			enumerable: false,
			writable: false,
			value: Object.freeze({
				version: 1,
				variant: variant.key,
				penId: pen.id,
				options,
				environment: {
					userAgent: navigator.userAgent,
					dpr: devicePixelRatio,
					viewport: [innerWidth, innerHeight],
					visibility: document.visibilityState,
				},
				rows,
				measurements,
			}),
		});
		return rows;
	} finally {
		overlay.remove();
	}
}
