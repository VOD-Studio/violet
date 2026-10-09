import {
	type PaneStats,
	prepareSketchCanvas,
	renderRough,
	renderSketchSvg,
} from "@features/lab/sketch/lib/render";
import { buildStyle, HANDS, type HandId, PENS, type PenId } from "@features/lab/sketch/lib/styles";
import { loadMermaidScene } from "@features/lab/sketch/model/mermaid";
import {
	type BenchScene,
	FILL_LABELS,
	type FillId,
	fillsScene,
	holesScene,
	illustrationScene,
	palette,
	primitivesScene,
	type SceneKey,
} from "@features/lab/sketch/model/scenes";
import { LabHeader } from "@features/lab/ui/LabHeader";
import { createPlayer, type Player, type ScheduleMode } from "@violet/sketch";
import { drawCanvas } from "@violet/sketch/canvas";
import { seekSvg } from "@violet/sketch/svg";
import { Button, Segmented } from "@violet/ui";
import { Pause, Play, RotateCcw, Shuffle } from "lucide-react";
import { type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from "react";

type Backend = "svg" | "canvas";
type Zoom = "1" | "3";

const SCENES: { value: SceneKey; label: string }[] = [
	{ value: "illustration", label: "插画" },
	{ value: "primitives", label: "图元" },
	{ value: "fills", label: "填充" },
	{ value: "holes", label: "孔洞" },
	{ value: "mermaid", label: "Mermaid" },
];

const MODES: { value: ScheduleMode; label: string }[] = [
	{ value: "sequential", label: "顺序" },
	{ value: "parallel", label: "并行" },
	{ value: "stagger", label: "交错" },
];

const SPEEDS = ["0.5", "1", "2", "4"].map((value) => ({ value, label: `${value}×` }));

const FILLS = (Object.keys(FILL_LABELS) as FillId[]).map((value) => ({
	value,
	label: FILL_LABELS[value],
}));

const STROKE_WIDTH = 1.6;

function Field({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="flex flex-col gap-2">
			<span className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
				{label}
			</span>
			{children}
		</div>
	);
}

function formatStats(stats: PaneStats | null): string {
	if (!stats) return "—";
	return `${stats.ms.toFixed(1)} ms · ${(stats.bytes / 1024).toFixed(1)} KB · ${stats.paths} paths`;
}

interface PaneProps {
	title: string;
	note: string;
	stats: PaneStats | null;
	zoom: Zoom;
	/** 两侧共享滚动位置，放大后对照同一区域。 */
	scrollRef: RefObject<HTMLDivElement | null>;
	onScroll(): void;
	status?: string;
	children: ReactNode;
}

function Pane({ title, note, stats, zoom, scrollRef, onScroll, status, children }: PaneProps) {
	return (
		<section className="min-w-0">
			<header className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
				<h2 className="text-sm font-semibold">
					{title}
					<span className="ml-2 font-normal text-muted-foreground">{note}</span>
				</h2>
				<p className="font-mono text-xs text-muted-foreground tabular-nums">
					{formatStats(stats)}
				</p>
			</header>
			<div
				ref={scrollRef}
				onScroll={onScroll}
				className="relative overflow-auto rounded-2xl border border-border"
				style={{ background: palette.paper }}
			>
				<div style={{ width: `${Number(zoom) * 100}%` }}>{children}</div>
				{status && (
					<p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
						{status}
					</p>
				)}
			</div>
		</section>
	);
}

const formatTime = (seconds: number) => seconds.toFixed(2).padStart(5, "0");

/** Rough.js 与 @violet/sketch 同几何、同 seed 的并排对照，含笔、压感、卡通插画与整图时间轴。 */
export function SketchBenchPage() {
	const [sceneKey, setSceneKey] = useState<SceneKey>("illustration");
	const [pen, setPen] = useState<PenId>("cartoon");
	const [hand, setHand] = useState<HandId>("natural");
	const [fill, setFill] = useState<FillId>("hachure");
	const [seed, setSeed] = useState(7);
	const [zoom, setZoom] = useState<Zoom>("1");
	const [backend, setBackend] = useState<Backend>("svg");
	const [mode, setMode] = useState<ScheduleMode>("sequential");
	const [speed, setSpeed] = useState("1");
	const [playing, setPlaying] = useState(false);
	const [mermaid, setMermaid] = useState<BenchScene | null>(null);
	const [status, setStatus] = useState("");
	const [roughStats, setRoughStats] = useState<PaneStats | null>(null);
	const [sketchStats, setSketchStats] = useState<PaneStats | null>(null);
	const roughHost = useRef<HTMLDivElement>(null);
	const sketchHost = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const roughScroll = useRef<HTMLDivElement>(null);
	const sketchScroll = useRef<HTMLDivElement>(null);
	const syncing = useRef(false);
	const player = useRef<Player | null>(null);
	const speedRef = useRef(1);
	const sliderRef = useRef<HTMLInputElement>(null);
	const clockRef = useRef<HTMLSpanElement>(null);
	const durationRef = useRef(0);

	const switchScene = (next: SceneKey) => {
		setSceneKey(next);
		// 插画默认用卡通；离开插画时卡通退回签字笔，避免普通图元套用色线。
		if (next === "illustration") setPen("cartoon");
		else if (pen === "cartoon") setPen("fineliner");
	};

	useEffect(() => {
		if (sceneKey !== "mermaid" || mermaid) return;
		let active = true;
		setStatus("正在读取 Mermaid 布局…");
		loadMermaidScene(24)
			.then((scene) => {
				if (!active) return;
				setMermaid(scene);
				setStatus("");
			})
			.catch((error: unknown) => {
				if (active) setStatus(error instanceof Error ? error.message : String(error));
			});
		return () => {
			active = false;
		};
	}, [sceneKey, mermaid]);

	const scene = useMemo<BenchScene | null>(() => {
		if (sceneKey === "primitives") return primitivesScene(fill);
		if (sceneKey === "fills") return fillsScene();
		if (sceneKey === "holes") return holesScene(fill);
		if (sceneKey === "illustration") return illustrationScene();
		return mermaid;
	}, [sceneKey, fill, mermaid]);

	useEffect(() => {
		speedRef.current = Number(speed);
		if (player.current) player.current.rate = Number(speed);
	}, [speed]);

	// zoom 改变画布显示宽度，Canvas 需按新尺寸重新分配像素。
	// biome-ignore lint/correctness/useExhaustiveDependencies: zoom 只作为重绘触发条件
	useEffect(() => {
		const roughNode = roughHost.current;
		const sketchNode = sketchHost.current;
		if (!scene || !roughNode || !sketchNode) return;
		const options = { seed, width: STROKE_WIDTH };
		const style = buildStyle(pen, hand);
		let seek: (time: number) => void = () => {};
		let duration = 0;
		try {
			const rough = renderRough(scene, palette, options);
			rough.svg.setAttribute("style", "display:block;width:100%;height:auto");
			roughNode.replaceChildren(rough.svg);
			setRoughStats(rough.stats);
			if (backend === "svg") {
				const sketch = renderSketchSvg(scene, style, palette, options, mode);
				sketchNode.replaceChildren(sketch.svg);
				setSketchStats(sketch.stats);
				duration = sketch.schedule.duration;
				seek = (time) => seekSvg(sketch.svg, time);
			} else {
				sketchNode.replaceChildren();
				const canvas = canvasRef.current;
				if (canvas) {
					const prepared = prepareSketchCanvas(scene, style, palette, options, mode);
					setSketchStats(prepared.stats);
					duration = prepared.schedule.duration;
					seek = (time) =>
						drawCanvas(prepared.drawing, canvas, palette, {
							schedule: prepared.schedule,
							time,
						});
				}
			}
			setStatus("");
		} catch (error) {
			setStatus(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
			return;
		}
		durationRef.current = duration;
		const next = createPlayer({
			duration,
			rate: speedRef.current,
			onFrame: (time) => {
				seek(time);
				if (sliderRef.current)
					sliderRef.current.value = String(duration ? (time / duration) * 1000 : 0);
				if (clockRef.current)
					clockRef.current.textContent = `${formatTime(time)} / ${formatTime(duration)} s`;
			},
			onEnd: () => setPlaying(false),
		});
		// 重新生成后停在完整画面，由用户触发播放。
		next.seek(duration);
		player.current = next;
		setPlaying(false);
		return () => {
			next.cancel();
			if (player.current === next) player.current = null;
		};
	}, [scene, pen, hand, seed, backend, mode, zoom]);

	const sync = (from: RefObject<HTMLDivElement | null>, to: RefObject<HTMLDivElement | null>) => {
		if (syncing.current || !from.current || !to.current) return;
		syncing.current = true;
		to.current.scrollLeft = from.current.scrollLeft;
		to.current.scrollTop = from.current.scrollTop;
		requestAnimationFrame(() => {
			syncing.current = false;
		});
	};

	const togglePlay = () => {
		const current = player.current;
		if (!current) return;
		if (current.playing) current.pause();
		else current.play();
		setPlaying(current.playing);
	};

	const ratio = scene ? `${scene.width} / ${scene.height}` : "3 / 2";
	const pickFill = sceneKey === "primitives" || sceneKey === "holes";
	const penLabel = PENS.find((entry) => entry.value === pen)?.label;
	const handLabel =
		pen === "cartoon" ? "" : ` · ${HANDS.find((entry) => entry.value === hand)?.label}`;

	return (
		<div className="mx-auto w-full max-w-360 px-4 pt-8 pb-32 text-foreground sm:px-8">
			<LabHeader to="/lab/sketch" className="mb-10" />

			<div className="flex flex-wrap items-end gap-x-8 gap-y-5 border-b border-edge-hairline pb-6">
				<Field label="Scene">
					<div className="max-w-full overflow-x-auto">
						<Segmented
							value={sceneKey}
							onValueChange={switchScene}
							segments={SCENES}
							aria-label="场景"
						/>
					</div>
				</Field>
				<Field label="Pen">
					<div className="max-w-full overflow-x-auto">
						<Segmented
							value={pen}
							onValueChange={setPen}
							segments={PENS}
							aria-label="笔"
						/>
					</div>
				</Field>
				<Field label="Hand">
					<Segmented
						value={hand}
						onValueChange={setHand}
						segments={HANDS.map((entry) => ({ ...entry, disabled: pen === "cartoon" }))}
						aria-label="手法"
					/>
				</Field>
				{pickFill && (
					<Field label="Fill">
						<div className="max-w-full overflow-x-auto">
							<Segmented
								value={fill}
								onValueChange={setFill}
								segments={FILLS}
								aria-label="填充"
							/>
						</div>
					</Field>
				)}
				<div className="ml-auto flex flex-wrap items-end gap-x-6 gap-y-5">
					<Field label="Seed">
						<div className="flex items-center gap-2">
							<span className="w-10 font-mono text-sm tabular-nums">{seed}</span>
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="换一个 seed"
								onClick={() => setSeed(1 + Math.floor(Math.random() * 9999))}
							>
								<Shuffle className="size-4" />
							</Button>
						</div>
					</Field>
					<Field label="Zoom">
						<Segmented
							value={zoom}
							onValueChange={setZoom}
							segments={[
								{ value: "1", label: "1×" },
								{ value: "3", label: "3×" },
							]}
							aria-label="缩放"
						/>
					</Field>
					<Field label="Backend">
						<Segmented
							value={backend}
							onValueChange={setBackend}
							segments={[
								{ value: "svg", label: "SVG" },
								{ value: "canvas", label: "Canvas" },
							]}
							aria-label="本库渲染后端"
						/>
					</Field>
				</div>
			</div>

			<div className="mt-8 grid gap-8 lg:grid-cols-2">
				<Pane
					title="Rough.js"
					note="线上 Mermaid 配方 · 无压感与动画"
					stats={roughStats}
					zoom={zoom}
					scrollRef={roughScroll}
					onScroll={() => sync(roughScroll, sketchScroll)}
					status={status}
				>
					<div ref={roughHost} style={{ aspectRatio: ratio }} />
				</Pane>
				<Pane
					title="@violet/sketch"
					note={`0.2.0 · ${penLabel}${handLabel}`}
					stats={sketchStats}
					zoom={zoom}
					scrollRef={sketchScroll}
					onScroll={() => sync(sketchScroll, roughScroll)}
					status={status}
				>
					<div
						ref={sketchHost}
						hidden={backend !== "svg"}
						style={{ aspectRatio: ratio }}
					/>
					<canvas
						ref={canvasRef}
						hidden={backend !== "canvas"}
						className="block w-full"
						style={{ aspectRatio: ratio }}
					/>
				</Pane>
			</div>

			<section
				aria-label="整图时间轴"
				className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4 rounded-2xl border border-border p-4"
			>
				<div className="flex items-center gap-2">
					<Button variant="outline" size="sm" onClick={togglePlay}>
						{playing ? <Pause className="size-4" /> : <Play className="size-4" />}
						{playing ? "暂停" : "播放"}
					</Button>
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label="从头重播"
						onClick={() => {
							player.current?.restart();
							setPlaying(true);
						}}
					>
						<RotateCcw className="size-4" />
					</Button>
				</div>
				<div className="flex min-w-60 flex-1 items-center gap-3">
					<input
						ref={sliderRef}
						type="range"
						min={0}
						max={1000}
						defaultValue={1000}
						aria-label="时间轴进度"
						className="h-1 w-full cursor-pointer accent-foreground"
						onChange={(event) => {
							const current = player.current;
							if (!current) return;
							current.pause();
							setPlaying(false);
							current.seek((Number(event.target.value) / 1000) * durationRef.current);
						}}
					/>
					<span
						ref={clockRef}
						className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums"
					>
						00.00 / 00.00 s
					</span>
				</div>
				<Field label="Order">
					<Segmented
						value={mode}
						onValueChange={setMode}
						segments={MODES}
						aria-label="编排方式"
					/>
				</Field>
				<Field label="Speed">
					<Segmented
						value={speed}
						onValueChange={setSpeed}
						segments={SPEEDS}
						aria-label="播放速度"
					/>
				</Field>
			</section>

			<p className="mt-6 text-sm text-muted-foreground">
				两侧使用同一几何、线宽与 seed。耗时为单次生成加 DOM
				构建，会随设备与负载波动；可重放的基准见
				<code className="mx-1 font-mono text-xs">packages/sketch/bench</code>
				。时间轴只作用于本库一侧，暂停、跳转与倒放不重新生成笔画。
			</p>
		</div>
	);
}
