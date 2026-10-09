import { type BenchmarkRow, runBenchmarks } from "@features/lab/sketch-prototype/lib/benchmark";
import { renderRoughScene } from "@features/lab/sketch-prototype/lib/rough";
import { comicPalette, comicScene } from "@features/lab/sketch-prototype/model/comic-scene";
import {
	defaultPalette,
	loadMermaidScene,
	sceneFixtures,
} from "@features/lab/sketch-prototype/model/scenes";
import { externalPen, type Variant, variants } from "@features/lab/sketch-prototype/model/variants";
import { LabHeader } from "@features/lab/ui/LabHeader";
import { useNavigate, useSearch } from "@tanstack/react-router";
import type { DrawnScene, Palette, Scene } from "@violet/sketch";
import {
	createPencilPen,
	createPressurePen,
	drawCanvas,
	fills,
	generateScene,
	mountSvg,
	updateSvgPalette,
	updateSvgProgress,
} from "@violet/sketch";
import {
	Button,
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@violet/ui";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

interface ChoiceProps {
	/** 文案同时作为表单控件的可访问名称。 */
	label: string;
	value: string;
	options: readonly { value: string; label: string }[];
	/** 选择后仅通知宿主，不持久化。 */
	onChange(value: string): void;
}

function Choice({ label, value, options, onChange }: ChoiceProps) {
	const id = useId();
	return (
		<div className="min-w-0 space-y-2">
			<Label htmlFor={id}>{label}</Label>
			<Select value={value} onValueChange={onChange}>
				<SelectTrigger id={id} className="w-full min-w-0 shadow-none">
					<SelectValue />
				</SelectTrigger>
				<SelectContent className="animate-none shadow-none" position="popper">
					{options.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}

function message(error: unknown) {
	return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

const precision = 0.3;
const duration = 8000;
const panel = "min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-5";
const buttonClass = "rounded-lg shadow-none";

/** 五类笔迹的独立原型：共享几何、双后端、固定质量预算与整图时间轴。 */
export function SketchPrototypePage() {
	const search = useSearch({ strict: false });
	const navigate = useNavigate();
	const requestedVariant =
		"variant" in search && typeof search.variant === "string" ? search.variant : "comic";
	const variant =
		variants.find((entry) => entry.key === requestedVariant) ??
		variants.find((entry) => entry.key === "comic") ??
		variants[0];
	const variantIndex = variants.findIndex((entry) => entry.key === variant.key);
	const [sceneKey, setSceneKey] = useState("comic");
	const [backend, setBackend] = useState("svg");
	const [fillId, setFillId] = useState("solid");
	const [seed, setSeed] = useState(35);
	const [width, setWidth] = useState(2.2);
	const [angle, setAngle] = useState(35);
	const [aspect, setAspect] = useState(0.35);
	const [fiberCount, setFiberCount] = useState(7);
	const [grainDensity, setGrainDensity] = useState(0.35);
	const [useExternal, setUseExternal] = useState(false);
	const [maxCommands, setMaxCommands] = useState(600000);
	const [maxSamples, setMaxSamples] = useState(200000);
	const [paletteOverrides, setPaletteOverrides] = useState<Record<string, string>>({});
	const [mermaidNodes, setMermaidNodes] = useState(24);
	const [mermaidScene, setMermaidScene] = useState<Scene | null>(null);
	const [mermaidPending, setMermaidPending] = useState(false);
	const [mermaidError, setMermaidError] = useState("");
	const [progress, setProgress] = useState(1);
	const progressRef = useRef(1);
	const [playing, setPlaying] = useState(false);
	const [timelineStatus, setTimelineStatus] = useState("static");
	const [speed, setSpeed] = useState(1);
	const [sequential, setSequential] = useState(true);
	const [rows, setRows] = useState<BenchmarkRow[]>([]);
	const [benchmarkPending, setBenchmarkPending] = useState(false);
	const [benchmarkError, setBenchmarkError] = useState("");
	const [benchmarkVariant, setBenchmarkVariant] = useState("");
	const [renderError, setRenderError] = useState("");
	const [exportStatus, setExportStatus] = useState("");
	const [dpr, setDpr] = useState(1);
	const [reducedMotion, setReducedMotion] = useState(false);
	const svgHost = useRef<HTMLDivElement>(null);
	const roughHost = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const svgRef = useRef<SVGSVGElement | null>(null);
	const mounted = useRef(false);
	const exportUrl = useRef<string | null>(null);

	const switchVariant = useCallback(
		(key: string) => {
			setUseExternal(false);
			void navigate({ to: "/lab/sketch-prototype", search: { variant: key }, replace: true });
		},
		[navigate],
	);
	const cycleVariant = useCallback(
		(direction: number) => {
			const next = variants[(variantIndex + direction + variants.length) % variants.length];
			switchVariant(next.key);
		},
		[switchVariant, variantIndex],
	);

	useEffect(() => {
		const handleKey = (event: KeyboardEvent) => {
			if (
				event.defaultPrevented ||
				event.altKey ||
				event.ctrlKey ||
				event.metaKey ||
				event.shiftKey
			)
				return;
			const target = event.target;
			if (
				target instanceof HTMLElement &&
				(target.isContentEditable ||
					target.closest(
						"input, textarea, select, [contenteditable], [role='combobox'], [role='listbox'], [role='option'], [role='slider']",
					))
			)
				return;
			if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
			event.preventDefault();
			cycleVariant(event.key === "ArrowLeft" ? -1 : 1);
		};
		window.addEventListener("keydown", handleKey);
		return () => window.removeEventListener("keydown", handleKey);
	}, [cycleVariant]);

	useEffect(() => {
		mounted.current = true;
		const media = window.matchMedia("(prefers-reduced-motion: reduce)");
		const update = () => {
			setReducedMotion(media.matches);
			setDpr(window.devicePixelRatio);
		};
		update();
		media.addEventListener("change", update);
		return () => {
			mounted.current = false;
			media.removeEventListener("change", update);
			if (exportUrl.current) URL.revokeObjectURL(exportUrl.current);
		};
	}, []);

	useEffect(() => {
		if (sceneKey !== "mermaid") {
			setMermaidPending(false);
			setMermaidError("");
			return;
		}
		let active = true;
		setMermaidPending(true);
		setMermaidError("");
		setMermaidScene(null);
		void loadMermaidScene(mermaidNodes)
			.then((scene) => {
				if (active) setMermaidScene(scene);
			})
			.catch((error: unknown) => {
				if (active) setMermaidError(message(error));
			})
			.finally(() => {
				if (active) setMermaidPending(false);
			});
		return () => {
			active = false;
		};
	}, [sceneKey, mermaidNodes]);

	const scene =
		sceneKey === "comic"
			? comicScene
			: sceneKey === "mermaid"
				? mermaidScene
				: (sceneFixtures.find((entry) => entry.key === sceneKey)?.scene ?? null);
	const basePalette = sceneKey === "comic" ? comicPalette : defaultPalette;
	const palette: Palette = useMemo(
		() => ({ ...basePalette, ...paletteOverrides }),
		[basePalette, paletteOverrides],
	);
	const paletteRef = useRef(palette);
	paletteRef.current = palette;
	const pen = useMemo(
		() =>
			useExternal
				? externalPen
				: variant.key === "pressure"
					? createPressurePen({ angle, aspect })
					: variant.key === "pencil"
						? createPencilPen({ fiberCount, grainDensity })
						: variant.createPen(),
		[useExternal, variant, angle, aspect, fiberCount, grainDensity],
	);
	const selectedFill = fills.find((entry) => entry.id === fillId);
	const generated = useMemo((): { drawn: DrawnScene | null; error: string } => {
		if (!scene) return { drawn: null, error: "" };
		try {
			return {
				drawn: generateScene(scene, pen, {
					seed,
					width,
					precision,
					maxCommands,
					maxSamples,
					fill: selectedFill,
				}),
				error: "",
			};
		} catch (error) {
			return { drawn: null, error: message(error) };
		}
	}, [scene, pen, seed, width, maxCommands, maxSamples, selectedFill]);
	const drawn = generated.drawn;

	const seek = useCallback((next: number) => {
		const value = Math.max(0, Math.min(1, next));
		progressRef.current = value;
		setProgress(value);
	}, []);
	const pause = useCallback(() => {
		setPlaying(false);
		setTimelineStatus("paused");
	}, []);
	const play = useCallback(() => {
		if (!drawn) return;
		if (progressRef.current >= 1) seek(0);
		setPlaying(true);
		setTimelineStatus("playing");
	}, [drawn, seek]);
	const replay = useCallback(() => {
		if (!drawn) return;
		seek(0);
		setPlaying(true);
		setTimelineStatus("playing");
	}, [drawn, seek]);
	const cancel = useCallback(() => {
		setPlaying(false);
		seek(0);
		setTimelineStatus("cancelled");
	}, [seek]);
	const showComplete = useCallback(() => {
		setPlaying(false);
		seek(1);
		setTimelineStatus("static");
	}, [seek]);

	useEffect(() => {
		setPlaying(false);
		seek(1);
		setTimelineStatus(drawn ? "static" : "unavailable");
		setExportStatus("");
	}, [drawn, seek]);

	useEffect(() => {
		if (!playing || !drawn) return;
		let active = true;
		let frame = 0;
		let last = performance.now();
		const tick = (now: number) => {
			if (!active) return;
			const next = Math.min(1, progressRef.current + ((now - last) * speed) / duration);
			last = now;
			seek(next);
			if (next >= 1) {
				setPlaying(false);
				setTimelineStatus("complete");
			} else frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => {
			active = false;
			cancelAnimationFrame(frame);
		};
	}, [playing, drawn, speed, seek]);

	useEffect(() => {
		const host = svgHost.current;
		if (!host) return;
		host.replaceChildren();
		svgRef.current = null;
		setRenderError("");
		if (!drawn) return;
		try {
			const svg = mountSvg(drawn, paletteRef.current, "sketch-preview");
			svg.style.width = "100%";
			svg.style.height = "auto";
			svg.style.display = "block";
			svg.setAttribute("role", "img");
			svg.setAttribute("aria-label", "新绘图库矢量画面");
			host.append(svg);
			svgRef.current = svg;
		} catch (error) {
			setRenderError(message(error));
		}
	}, [drawn]);

	useEffect(() => {
		if (svgRef.current) updateSvgPalette(svgRef.current, palette);
	}, [palette]);
	useEffect(() => {
		if (svgRef.current && drawn) updateSvgProgress(svgRef.current, drawn, progress, sequential);
	}, [drawn, progress, sequential]);

	useEffect(() => {
		const host = roughHost.current;
		if (!host) return;
		host.replaceChildren();
		if (!scene) return;
		try {
			const svg = renderRoughScene(scene, palette, fillId, { seed, width });
			svg.style.width = "100%";
			svg.style.height = "auto";
			svg.style.display = "block";
			svg.setAttribute("role", "img");
			svg.setAttribute("aria-label", "同几何 Rough.js 对照");
			host.append(svg);
		} catch (error) {
			setRenderError(message(error));
		}
	}, [scene, palette, fillId, seed, width]);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || !drawn || backend !== "canvas") return;
		const render = () => {
			setDpr(window.devicePixelRatio);
			try {
				drawCanvas(drawn, canvas, palette, progressRef.current, sequential);
			} catch (error) {
				setRenderError(message(error));
			}
		};
		const observer = new ResizeObserver(render);
		observer.observe(canvas);
		window.addEventListener("resize", render);
		render();
		return () => {
			observer.disconnect();
			window.removeEventListener("resize", render);
		};
	}, [drawn, palette, sequential, backend]);
	useEffect(() => {
		const canvas = canvasRef.current;
		if (canvas && drawn && backend === "canvas") {
			try {
				drawCanvas(drawn, canvas, palette, progress, sequential);
			} catch (error) {
				setRenderError(message(error));
			}
		}
	}, [drawn, palette, progress, sequential, backend]);

	const exportSvg = useCallback(() => {
		if (!drawn) return;
		try {
			const svg = mountSvg(drawn, palette, "sketch-export");
			updateSvgProgress(svg, drawn, progressRef.current, sequential);
			const text = new XMLSerializer().serializeToString(svg);
			if (exportUrl.current) URL.revokeObjectURL(exportUrl.current);
			const url = URL.createObjectURL(
				new Blob([text], { type: "image/svg+xml;charset=utf-8" }),
			);
			exportUrl.current = url;
			const link = document.createElement("a");
			link.href = url;
			link.download = `sketch-${pen.id.replace(/[^a-z0-9_-]/gi, "-")}-${seed}.svg`;
			document.body.append(link);
			link.click();
			link.remove();
			setExportStatus(
				`已导出当前 ${Math.round(progressRef.current * 100)}% 画面 · ${text.length.toLocaleString()} 字符 · 纯矢量 SVG`,
			);
		} catch (error) {
			setExportStatus(message(error));
		}
	}, [drawn, palette, sequential, pen.id, seed]);

	const benchmark = useCallback(async () => {
		if (benchmarkPending) return;
		setBenchmarkPending(true);
		setBenchmarkError("");
		setRows([]);
		setBenchmarkVariant(`${variant.key}${useExternal ? " / external" : ""}`);
		const configuredVariant: Variant = { ...variant, createPen: () => pen };
		try {
			const result = await runBenchmarks(configuredVariant);
			if (mounted.current) setRows(result);
		} catch (error) {
			if (mounted.current) setBenchmarkError(message(error));
		} finally {
			if (mounted.current) setBenchmarkPending(false);
		}
	}, [benchmarkPending, variant, useExternal, pen]);

	const state = {
		variant: variant.key,
		penId: pen.id,
		external: useExternal,
		scene: sceneKey,
		sceneItems: scene?.items.length ?? 0,
		sceneSize: scene ? [scene.width, scene.height] : null,
		backend,
		fillId,
		seed,
		width,
		angle,
		aspect,
		pencil: { fiberCount, grainDensity },
		precision,
		maxCommands,
		maxSamples,
		commands: drawn?.commands ?? null,
		samples: drawn?.samples ?? null,
		layers: drawn?.items.reduce((sum, item) => sum + item.layers.length, 0) ?? null,
		generateMs: drawn?.generateMs ?? null,
		palette,
		timeline: { status: timelineStatus, progress, speed, durationMs: duration, sequential },
		mermaid: { nodes: mermaidNodes, pending: mermaidPending, error: mermaidError },
		device: { dpr, reducedMotion },
		error: generated.error || renderError,
		benchmarkVariant,
	};
	const smokeRef = useRef({
		state,
		play,
		pause,
		replay,
		cancel,
		seek,
		showComplete,
		exportSvg,
		switchVariant,
	});
	smokeRef.current = {
		state,
		play,
		pause,
		replay,
		cancel,
		seek,
		showComplete,
		exportSvg,
		switchVariant,
	};
	useEffect(() => {
		const bridge = Object.freeze({
			get state() {
				return JSON.parse(JSON.stringify(smokeRef.current.state)) as unknown;
			},
			play: () => smokeRef.current.play(),
			pause: () => smokeRef.current.pause(),
			replay: () => smokeRef.current.replay(),
			cancel: () => smokeRef.current.cancel(),
			seek: (value: number) => {
				if (Number.isFinite(value)) smokeRef.current.seek(value);
			},
			showComplete: () => smokeRef.current.showComplete(),
			exportSvg: () => smokeRef.current.exportSvg(),
			switchVariant: (key: string) => {
				if (variants.some((entry) => entry.key === key))
					smokeRef.current.switchVariant(key);
			},
		});
		Object.defineProperty(window, "sketchPrototype", {
			configurable: true,
			enumerable: false,
			value: bridge,
			writable: false,
		});
		return () => {
			Reflect.deleteProperty(window, "sketchPrototype");
		};
	}, []);

	return (
		<div className="mx-auto max-w-360 px-4 pt-8 pb-32 text-foreground sm:px-8">
			<LabHeader to="/lab/sketch-prototype" className="mb-8" />
			<div className="mb-6 flex flex-wrap items-center justify-between gap-3">
				<div>
					<p className="font-mono text-xs text-muted-foreground">
						PRD-0035 · 独立原型 · 不修改正式绘图链路
					</p>
					<h2 className="mt-2 text-xl font-semibold">
						{variant.title}
						{useExternal ? " · 外部笔迹" : ""}
					</h2>
					<p className="mt-1 text-sm text-muted-foreground">{variant.note}</p>
				</div>
				<Button
					className={buttonClass}
					variant="outline"
					aria-pressed={useExternal}
					onClick={() => setUseExternal((value) => !value)}
				>
					{useExternal ? "返回样例笔迹" : "运行外部 Pen"}
				</Button>
			</div>
			<section aria-label="绘图配置" className={`${panel} mb-6`}>
				<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
					<Choice
						label="笔迹样例（URL）"
						value={variant.key}
						options={variants.map((entry) => ({
							value: entry.key,
							label: entry.title,
						}))}
						onChange={switchVariant}
					/>
					<Choice
						label="场景"
						value={sceneKey}
						options={[
							{ value: "comic", label: "完整彩色漫画" },
							...sceneFixtures
								.filter((entry) => entry.key !== "comic" && entry.key !== "mermaid")
								.map((entry) => ({ value: entry.key, label: entry.title })),
							{ value: "mermaid", label: "真实 Mermaid 布局" },
						]}
						onChange={setSceneKey}
					/>
					<Choice
						label="新库后端"
						value={backend}
						options={[
							{ value: "svg", label: "SVG · 矢量 DOM" },
							{ value: "canvas", label: "Canvas · 同一矢量" },
						]}
						onChange={setBackend}
					/>
					<Choice
						label="区域填充"
						value={fillId}
						options={fills.map((entry) => ({ value: entry.id, label: entry.id }))}
						onChange={setFillId}
					/>
					<div className="space-y-2">
						<Label htmlFor="sketch-seed">随机种子</Label>
						<Input
							id="sketch-seed"
							type="number"
							min={0}
							max={2147483647}
							step={1}
							value={seed}
							onChange={(event) => {
								const n = event.currentTarget.valueAsNumber;
								if (Number.isInteger(n) && n >= 0 && n <= 2147483647) setSeed(n);
							}}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="sketch-width">线宽 · {width.toFixed(1)}</Label>
						<Input
							id="sketch-width"
							type="range"
							min={0.5}
							max={12}
							step={0.1}
							value={width}
							onChange={(event) => setWidth(event.currentTarget.valueAsNumber)}
							className="h-9 w-full p-0"
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="sketch-command-budget">命令预算（不自动降质）</Label>
						<Input
							id="sketch-command-budget"
							type="number"
							min={1}
							step={1000}
							value={maxCommands}
							onChange={(event) => {
								const n = event.currentTarget.valueAsNumber;
								if (Number.isInteger(n) && n > 0) setMaxCommands(n);
							}}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="sketch-sample-budget">
							采样预算（固定误差 {precision}）
						</Label>
						<Input
							id="sketch-sample-budget"
							type="number"
							min={1}
							step={1000}
							value={maxSamples}
							onChange={(event) => {
								const n = event.currentTarget.valueAsNumber;
								if (Number.isInteger(n) && n > 0) setMaxSamples(n);
							}}
						/>
					</div>
				</div>
				{variant.key === "pencil" && !useExternal && (
					<div className="mt-4 grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label htmlFor="sketch-fibers">纤维根数 · {fiberCount}</Label>
							<Input
								id="sketch-fibers"
								type="range"
								min={0}
								max={16}
								step={1}
								value={fiberCount}
								onChange={(event) =>
									setFiberCount(event.currentTarget.valueAsNumber)
								}
								className="h-9 w-full p-0"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="sketch-grain-density">
								颗粒 / 平方单位 · {grainDensity.toFixed(2)}
							</Label>
							<Input
								id="sketch-grain-density"
								type="range"
								min={0}
								max={2}
								step={0.05}
								value={grainDensity}
								onChange={(event) =>
									setGrainDensity(event.currentTarget.valueAsNumber)
								}
								className="h-9 w-full p-0"
							/>
						</div>
						<p className="col-span-2 text-xs text-muted-foreground">
							纹理按此固定配方生成；提高密度可能显式超限，不会自动调低。密度不再随曲线细分或段尾取整膨胀。
						</p>
					</div>
				)}
				{variant.key === "pressure" && !useExternal && (
					<div className="mt-4 grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label htmlFor="sketch-angle">扁笔角度 · {angle}°</Label>
							<Input
								id="sketch-angle"
								type="range"
								min={-90}
								max={90}
								step={1}
								value={angle}
								onChange={(event) => setAngle(event.currentTarget.valueAsNumber)}
								className="h-9 w-full p-0"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="sketch-aspect">
								笔尖短轴比例 · {aspect.toFixed(2)}
							</Label>
							<Input
								id="sketch-aspect"
								type="range"
								min={0.1}
								max={1}
								step={0.05}
								value={aspect}
								onChange={(event) => setAspect(event.currentTarget.valueAsNumber)}
								className="h-9 w-full p-0"
							/>
						</div>
					</div>
				)}
				{sceneKey === "mermaid" && (
					<div className="mt-4 space-y-2">
						<Label htmlFor="sketch-mermaid-nodes">Mermaid 节点数（加载真实布局）</Label>
						<Input
							id="sketch-mermaid-nodes"
							type="number"
							min={2}
							max={1000}
							value={mermaidNodes}
							onChange={(event) => {
								const n = event.currentTarget.valueAsNumber;
								if (Number.isInteger(n) && n >= 2 && n <= 1000) setMermaidNodes(n);
							}}
							className="max-w-50"
						/>
						<p className="text-xs text-muted-foreground">
							只在原型直接调用
							loadMermaidScene；布局、字体与净化成本不等同于笔迹生成。
						</p>
					</div>
				)}
				<details className="mt-4">
					<summary className="cursor-pointer text-sm">
						颜色角色 · 仅重绘、不重新生成笔迹
					</summary>
					<div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
						{Object.entries(basePalette).map(([role, color]) => (
							<div key={role} className="min-w-0 space-y-1">
								<Label
									htmlFor={`sketch-color-${role}`}
									className="block truncate text-xs"
								>
									{role}
								</Label>
								<Input
									id={`sketch-color-${role}`}
									type="color"
									value={paletteOverrides[role] ?? color}
									onChange={(event) => {
										const value = event.currentTarget.value;
										setPaletteOverrides((current) => ({
											...current,
											[role]: value,
										}));
									}}
									className="h-9 w-full p-1"
								/>
							</div>
						))}
					</div>
					<Button
						className={`${buttonClass} mt-3`}
						size="sm"
						variant="ghost"
						onClick={() => setPaletteOverrides({})}
					>
						恢复场景配色
					</Button>
				</details>
			</section>

			{(generated.error || mermaidError || renderError) && (
				<div
					role="alert"
					className="mb-6 rounded-xl border border-destructive bg-card p-4 text-sm text-destructive"
				>
					<strong>绘制失败 / 固定质量超限</strong>
					<p className="mt-1 wrap-break-word">
						{generated.error || mermaidError || renderError}
					</p>
					<p className="mt-2">
						没有截断输出、减少纹理或放宽误差；请明确调整预算或配置后重新生成。Rough.js
						对照不代表新库成功。
					</p>
				</div>
			)}
			{mermaidPending && (
				<p role="status" className="mb-4 text-sm text-muted-foreground">
					正在生成 Mermaid 布局…
				</p>
			)}
			<div className="grid min-w-0 gap-4 xl:grid-cols-2">
				<section className={panel} aria-label="新绘图库画面">
					<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
						<h3 className="font-semibold">新绘图库 · {backend.toUpperCase()}</h3>
						<span className="font-mono text-xs text-muted-foreground">{pen.id}</span>
					</div>
					<div className="overflow-hidden rounded-lg border border-border bg-background">
						<div ref={svgHost} hidden={backend !== "svg"} />
						{backend === "canvas" && drawn && (
							<canvas
								ref={canvasRef}
								aria-label="新绘图库 Canvas 画面"
								style={{
									width: "100%",
									height: "auto",
									aspectRatio: `${drawn.width} / ${drawn.height}`,
									display: "block",
								}}
							/>
						)}
						{!drawn && (
							<div className="flex min-h-60 items-center justify-center p-6 text-sm text-muted-foreground">
								{mermaidPending ? "布局加载中" : "暂无完整绘制结果"}
							</div>
						)}
					</div>
				</section>
				<section className={panel} aria-label="Rough.js 对照">
					<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
						<h3 className="font-semibold">Rough.js · 同几何对照</h3>
						<span className="text-xs text-muted-foreground">
							相同布局 / 颜色 / seed / 线宽
						</span>
					</div>
					<div
						ref={roughHost}
						className="overflow-hidden rounded-lg border border-border bg-background"
					/>
					<p className="mt-3 text-xs text-muted-foreground">
						对照始终完整显示；压感、颗粒与彩漫笔墨层没有直接等价算法，不据此宣称质量相同。
					</p>
				</section>
			</div>

			<section aria-label="整图时间轴" className={`${panel} mt-6`}>
				<div className="flex flex-wrap items-center justify-between gap-3">
					<h3 className="font-semibold">整图时间轴 · {timelineStatus}</h3>
					<p className="font-mono text-xs text-muted-foreground">
						{(progress * 100).toFixed(1)}% · {((progress * duration) / 1000).toFixed(2)}{" "}
						/ {duration / 1000}s
					</p>
				</div>
				<div className="mt-4 flex flex-wrap gap-2">
					<Button className={buttonClass} disabled={!drawn || playing} onClick={play}>
						{timelineStatus === "paused" ? "恢复" : "播放"}
					</Button>
					<Button
						className={buttonClass}
						variant="outline"
						disabled={!playing}
						onClick={pause}
					>
						暂停
					</Button>
					<Button
						className={buttonClass}
						variant="outline"
						disabled={!drawn}
						onClick={cancel}
					>
						取消
					</Button>
					<Button
						className={buttonClass}
						variant="outline"
						disabled={!drawn}
						onClick={replay}
					>
						重播
					</Button>
					<Button
						className={buttonClass}
						variant="ghost"
						disabled={!drawn}
						onClick={showComplete}
					>
						完整静态画面
					</Button>
					<Button
						className={buttonClass}
						variant="outline"
						disabled={!drawn}
						onClick={exportSvg}
					>
						导出当前 SVG
					</Button>
				</div>
				<div className="mt-4 grid gap-4 sm:grid-cols-[1fr_10rem_10rem]">
					<div className="space-y-2">
						<Label htmlFor="sketch-progress">进度跳转（复用已生成笔迹）</Label>
						<Input
							id="sketch-progress"
							type="range"
							min={0}
							max={1}
							step={0.001}
							value={progress}
							disabled={!drawn}
							onChange={(event) => seek(event.currentTarget.valueAsNumber)}
							className="h-9 w-full p-0"
						/>
					</div>
					<Choice
						label="播放速度"
						value={String(speed)}
						options={[0.25, 0.5, 1, 2, 4].map((value) => ({
							value: String(value),
							label: `${value}×`,
						}))}
						onChange={(value) => setSpeed(Number(value))}
					/>
					<Choice
						label="图层编排"
						value={sequential ? "sequential" : "parallel"}
						options={[
							{ value: "sequential", label: "顺序" },
							{ value: "parallel", label: "并行" },
						]}
						onChange={(value) => setSequential(value === "sequential")}
					/>
				</div>
				<p className="mt-3 text-xs text-muted-foreground">
					首次展示为完整静态图；播放仅由明确操作触发。更换颜色、后端、时间轴进度与编排均不重新随机生成。
					{reducedMotion ? " 当前系统偏好减弱动态；可保留静态展示，播放为主动预览。" : ""}
				</p>
				{exportStatus && (
					<p role="status" className="mt-3 text-sm">
						{exportStatus}
					</p>
				)}
			</section>

			<section className={`${panel} mt-6`} aria-label="性能基准">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<h3 className="font-semibold">
							固定质量基准{benchmarkVariant ? ` · ${benchmarkVariant}` : ""}
						</h3>
						<p className="mt-1 text-xs text-muted-foreground">
							runBenchmarks 使用其可重放固定场景与配置，不是上方交互画面的计时。
						</p>
					</div>
					<Button
						className={buttonClass}
						variant="outline"
						loading={benchmarkPending}
						loadingText="测量中…"
						onClick={() => void benchmark()}
					>
						运行阶段基准
					</Button>
				</div>
				{benchmarkError && (
					<p role="alert" className="mt-3 text-sm text-destructive">
						{benchmarkError}
					</p>
				)}
				{rows.length > 0 && (
					<div className="mt-4 max-w-full overflow-x-auto">
						<table className="w-full text-left text-xs">
							<caption className="sr-only">固定质量各场景各阶段测量</caption>
							<thead className="border-b border-border text-muted-foreground">
								<tr>
									{[
										"场景",
										"阶段",
										"p50 ms",
										"p95 ms",
										"命令",
										"样本",
										"字节",
										"节点",
										"观测 / 限制",
									].map((heading) => (
										<th
											key={heading}
											scope="col"
											className="p-2 whitespace-nowrap font-medium"
										>
											{heading}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{rows.map((row, index) => (
									<tr
										key={`${row.scenario}-${row.stage}-${index}`}
										className="border-b border-border"
									>
										<td className="p-2 whitespace-nowrap">{row.scenario}</td>
										<td className="p-2 whitespace-nowrap">{row.stage}</td>
										<td className="p-2 font-mono">
											{Number.isFinite(row.medianMs)
												? row.medianMs.toFixed(2)
												: "—"}
										</td>
										<td className="p-2 font-mono">
											{Number.isFinite(row.p95Ms)
												? row.p95Ms.toFixed(2)
												: "—"}
										</td>
										<td className="p-2 font-mono">{row.commands}</td>
										<td className="p-2 font-mono">{row.samples}</td>
										<td className="p-2 font-mono">{row.bytes}</td>
										<td className="p-2 font-mono">{row.nodes}</td>
										<td className="min-w-60 p-2">{row.note}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
				<p className="mt-4 text-xs leading-relaxed text-muted-foreground">
					原型测量不是 60FPS 保证。Canvas 调用返回、DOM 提交与 requestAnimationFrame
					都不等于像素已经呈现；真实可见帧、GPU
					完成与内存需要浏览器专门观测。插件预算只计量采样与输出命令，不能抢占任意同步外部
					JavaScript。超限行和未观测阶段请以结果 note 为准。
				</p>
			</section>
			<section className={`${panel} mt-6`} aria-label="完整原型状态">
				<h3 className="font-semibold">完整状态 · 仅内存</h3>
				<p className="mt-2 text-xs text-muted-foreground">
					浏览器只读观测入口 window.sketchPrototype.state；play / pause / replay / cancel
					/ seek / showComplete / exportSvg / switchVariant 可用于实际 smoke。
				</p>
				<pre className="mt-4 max-h-120 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed">
					{JSON.stringify(state, null, 2)}
				</pre>
			</section>
			<nav
				aria-label="笔迹样例切换"
				className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-110 items-center justify-between gap-3 rounded-2xl border border-border bg-popover p-2 text-popover-foreground"
			>
				<Button
					className={buttonClass}
					size="icon-sm"
					variant="ghost"
					aria-label="上一个样例"
					onClick={() => cycleVariant(-1)}
				>
					←
				</Button>
				<div className="min-w-0 text-center">
					<p className="truncate text-sm font-medium">{variant.title}</p>
					<p className="font-mono text-xs text-muted-foreground">
						{variantIndex + 1} / {variants.length} · ?variant={variant.key}
					</p>
				</div>
				<Button
					className={buttonClass}
					size="icon-sm"
					variant="ghost"
					aria-label="下一个样例"
					onClick={() => cycleVariant(1)}
				>
					→
				</Button>
			</nav>
		</div>
	);
}
