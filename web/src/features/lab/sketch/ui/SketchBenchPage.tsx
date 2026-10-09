import {
	type HandId,
	type PaneStats,
	renderRough,
	renderSketchCanvas,
	renderSketchSvg,
} from "@features/lab/sketch/lib/render";
import { loadMermaidScene } from "@features/lab/sketch/model/mermaid";
import {
	type BenchScene,
	FILL_LABELS,
	type FillId,
	fillsScene,
	holesScene,
	palette,
	primitivesScene,
} from "@features/lab/sketch/model/scenes";
import { LabHeader } from "@features/lab/ui/LabHeader";
import { Button, Segmented } from "@violet/ui";
import { Shuffle } from "lucide-react";
import { type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from "react";

type SceneKey = "primitives" | "fills" | "holes" | "mermaid";
type Backend = "svg" | "canvas";
type Zoom = "1" | "3";

const SCENES: { value: SceneKey; label: string }[] = [
	{ value: "primitives", label: "图元" },
	{ value: "fills", label: "填充" },
	{ value: "holes", label: "孔洞" },
	{ value: "mermaid", label: "Mermaid" },
];

const HANDS: { value: HandId; label: string }[] = [
	{ value: "neat", label: "工整" },
	{ value: "natural", label: "自然" },
	{ value: "draft", label: "草稿" },
];

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

/** Rough.js 与 @violet/sketch 同几何、同 seed 的并排对照。 */
export function SketchBenchPage() {
	const [sceneKey, setSceneKey] = useState<SceneKey>("primitives");
	const [hand, setHand] = useState<HandId>("natural");
	const [fill, setFill] = useState<FillId>("hachure");
	const [seed, setSeed] = useState(7);
	const [zoom, setZoom] = useState<Zoom>("1");
	const [backend, setBackend] = useState<Backend>("svg");
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
		return mermaid;
	}, [sceneKey, fill, mermaid]);

	// zoom 改变画布显示宽度，Canvas 需按新尺寸重新分配像素。
	// biome-ignore lint/correctness/useExhaustiveDependencies: zoom 只作为重绘触发条件
	useEffect(() => {
		const roughNode = roughHost.current;
		const sketchNode = sketchHost.current;
		if (!scene || !roughNode || !sketchNode) return;
		const options = { seed, width: STROKE_WIDTH };
		try {
			const rough = renderRough(scene, palette, options);
			rough.svg.style.cssText = "display:block;width:100%;height:auto";
			roughNode.replaceChildren(rough.svg);
			setRoughStats(rough.stats);
			if (backend === "svg") {
				const sketch = renderSketchSvg(scene, hand, palette, options);
				sketchNode.replaceChildren(sketch.svg);
				setSketchStats(sketch.stats);
			} else {
				sketchNode.replaceChildren();
				const canvas = canvasRef.current;
				if (canvas)
					setSketchStats(renderSketchCanvas(scene, hand, palette, canvas, options));
			}
			setStatus("");
		} catch (error) {
			setStatus(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
		}
	}, [scene, hand, seed, backend, zoom]);

	const sync = (from: RefObject<HTMLDivElement | null>, to: RefObject<HTMLDivElement | null>) => {
		if (syncing.current || !from.current || !to.current) return;
		syncing.current = true;
		to.current.scrollLeft = from.current.scrollLeft;
		to.current.scrollTop = from.current.scrollTop;
		requestAnimationFrame(() => {
			syncing.current = false;
		});
	};

	const ratio = scene ? `${scene.width} / ${scene.height}` : "3 / 2";
	const pickFill = sceneKey === "primitives" || sceneKey === "holes";

	return (
		<div className="mx-auto w-full max-w-360 px-4 pt-8 pb-32 text-foreground sm:px-8">
			<LabHeader to="/lab/sketch" className="mb-10" />

			<div className="flex flex-wrap items-end gap-x-8 gap-y-5 border-b border-edge-hairline pb-6">
				<Field label="Scene">
					<Segmented
						value={sceneKey}
						onValueChange={setSceneKey}
						segments={SCENES}
						aria-label="场景"
					/>
				</Field>
				<Field label="Hand">
					<Segmented
						value={hand}
						onValueChange={setHand}
						segments={HANDS}
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
					note="线上 Mermaid 配方"
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
					note={`0.2.0 · ${HANDS.find((h) => h.value === hand)?.label}`}
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

			<p className="mt-6 text-sm text-muted-foreground">
				两侧使用同一几何、线宽与 seed。耗时为单次生成加 DOM
				构建，会随设备与负载波动；可重放的基准见
				<code className="mx-1 font-mono text-xs">packages/sketch/bench</code>。
			</p>
		</div>
	);
}
