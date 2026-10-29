import { diagramRenderers } from "@shared/ui/diagram/renderers";
import { useHydrated } from "@tanstack/react-router";
import { Button, Segmented } from "@violet/ui";
import {
	createFineliner,
	createGPen,
	createInkPen,
	createMarker,
	draw,
	type PenFactory,
	type SceneItem,
} from "@violetjs/inkline";
import { Shuffle } from "lucide-react";
import { lazy, type ReactNode, Suspense, useMemo } from "react";
import * as fillsExample from "../../../../packages/inkline/examples/fills";
import * as handsExample from "../../../../packages/inkline/examples/hands";
import * as lineWashExample from "../../../../packages/inkline/examples/line-wash";
import * as pensExample from "../../../../packages/inkline/examples/pens";
import * as quickStart from "../../../../packages/inkline/examples/quick-start";
import { useSiteAppearance } from "../hooks/useSiteAppearance";
import { MERMAID_DIAGRAM } from "../lib/examples";
import { type DemoTheme, themedPalette } from "../lib/theme-palette";
import { useWorkbenchStore } from "../model/workbench-store";
import { DrawingView } from "./DrawingView";
import { Field } from "./fields";

/** 画面下方按图形中心对齐的说明，x 以场景坐标计；note 只在宽屏显示，窄屏放不下。 */
function Captions({
	width,
	items,
}: {
	width: number;
	items: readonly { x: number; text: string; note?: string }[];
}) {
	return (
		<div className="relative h-5 text-xs text-muted-foreground">
			{items.map(({ x, text, note }) => (
				<span
					key={text}
					className="absolute -translate-x-1/2 whitespace-nowrap"
					style={{ left: `${(x / width) * 100}%` }}
				>
					{text}
					{note && <span className="hidden sm:inline"> · {note}</span>}
				</span>
			))}
		</div>
	);
}

function Figure({ children, className }: { children: ReactNode; className?: string }) {
	return (
		<figure className={className ?? "mx-auto grid w-full max-w-3xl gap-2"}>{children}</figure>
	);
}

const quickStartLabel = "带排线填充的圆角卡片";

export function QuickStartStage() {
	const appearance = useSiteAppearance();
	return (
		<Figure className="mx-auto w-full max-w-xl">
			<DrawingView
				drawing={quickStart.drawing}
				palette={themedPalette(quickStart.palette, appearance)}
				label={quickStartLabel}
				className="aspect-240/150"
			/>
		</Figure>
	);
}

const PEN_FACTORIES: Record<string, PenFactory> = {
	fineliner: createFineliner,
	inkpen: createInkPen,
	marker: createMarker,
	gpen: createGPen,
};
const PEN_CAPTIONS = [
	{ text: "签字笔", note: "等宽" },
	{ text: "钢笔", note: "两端收尖" },
	{ text: "马克笔", note: "半透明斜头" },
	{ text: "G 笔", note: "细到粗" },
];

export function PensStage() {
	const pressure = useWorkbenchStore((s) => s.pressure);
	const appearance = useSiteAppearance();
	const drawing = useMemo(() => {
		const items = pensExample.scene.items.map((item): SceneItem => {
			const factory = item.style?.pen && PEN_FACTORIES[item.style.pen.id];
			return factory && item.style
				? { ...item, style: { ...item.style, pen: factory({ pressure }) } }
				: item;
		});
		return draw({ ...pensExample.scene, items }, pensExample.options);
	}, [pressure]);
	return (
		<Figure>
			<DrawingView
				drawing={drawing}
				palette={themedPalette(pensExample.palette, appearance)}
				label={`四支笔，压感 ${pressure.toFixed(2)}`}
				className="aspect-530/120"
			/>
			<Captions
				width={530}
				items={PEN_CAPTIONS.map((caption, i) => ({ ...caption, x: 70 + i * 130 }))}
			/>
		</Figure>
	);
}

export function PensParams() {
	const pressure = useWorkbenchStore((s) => s.pressure);
	const set = useWorkbenchStore((s) => s.set);
	return (
		<div className="grid gap-3">
			<Field label="压感强度" value={pressure.toFixed(2)}>
				{(id) => (
					<input
						id={id}
						type="range"
						min={0}
						max={1}
						step={0.05}
						value={pressure}
						onChange={(event) => set({ pressure: Number(event.target.value) })}
						className="w-full accent-primary"
					/>
				)}
			</Field>
			<p className="text-xs leading-relaxed text-muted-foreground">
				压感是笔的属性：同一支笔压力越大，笔画越粗、越浓。用工厂函数创建同款笔，例如{" "}
				<code className="font-mono">
					createGPen({`{ pressure: ${pressure.toFixed(2)} }`})
				</code>
				。
			</p>
		</div>
	);
}

const HAND_CAPTIONS = [
	{ text: "工整" },
	{ text: "自然" },
	{ text: "草稿", note: "每笔两遍" },
	{ text: "勾线" },
];

export function HandsStage() {
	const seed = useWorkbenchStore((s) => s.seed);
	const appearance = useSiteAppearance();
	const drawing = useMemo(
		() => draw(handsExample.scene, { ...handsExample.options, seed }),
		[seed],
	);
	return (
		<Figure>
			<DrawingView
				drawing={drawing}
				palette={themedPalette(handsExample.palette, appearance)}
				label={`四种手法，seed ${seed}`}
				className="aspect-530/120"
			/>
			<Captions
				width={530}
				items={HAND_CAPTIONS.map((caption, i) => ({ ...caption, x: 70 + i * 130 }))}
			/>
		</Figure>
	);
}

export function HandsParams() {
	const seed = useWorkbenchStore((s) => s.seed);
	const set = useWorkbenchStore((s) => s.set);
	return (
		<div className="grid gap-3">
			<Field label="seed" value={seed}>
				{(id) => (
					<div className="flex gap-2">
						<Button
							id={id}
							size="sm"
							variant="outline"
							onClick={() => set({ seed: (seed * 7919 + 13) % 10_007 })}
						>
							<Shuffle aria-hidden />
							换一个 seed
						</Button>
						<Button
							size="sm"
							variant="ghost"
							onClick={() => set({ seed: 7 })}
							disabled={seed === 7}
						>
							回到 7
						</Button>
					</div>
				)}
			</Field>
			<p className="text-xs leading-relaxed text-muted-foreground">
				同一 seed 永远得到同一组笔画；换 seed 就是另一次落笔。修改一个图形不会影响其他图形。
			</p>
		</div>
	);
}

export function FillsStage() {
	const appearance = useSiteAppearance();
	const fills = useMemo(() => draw(fillsExample.scene, fillsExample.options), []);
	const lineWash = useMemo(() => draw(lineWashExample.scene, lineWashExample.options), []);
	return (
		<div className="mx-auto grid w-full max-w-5xl items-center gap-6 xl:grid-cols-[3fr_2fr]">
			<Figure className="grid gap-2">
				<DrawingView
					drawing={fills}
					palette={themedPalette(fillsExample.palette, appearance)}
					label="八种填充"
					className="aspect-530/230"
				/>
				<figcaption className="text-xs leading-relaxed text-muted-foreground">
					上排：排线、交叉线、点阵、实色；下排：宽间距排线、锯齿、虚线、淡彩。
				</figcaption>
			</Figure>
			<Figure className="grid gap-2">
				<DrawingView
					drawing={lineWash}
					palette={themedPalette(lineWashExample.palette, appearance)}
					label="线描淡彩风格的房子与太阳"
					className="aspect-400/280"
				/>
				<figcaption className="text-xs text-muted-foreground">
					线描淡彩：勾线手法 + G 笔 + 淡彩填充
				</figcaption>
			</Figure>
		</div>
	);
}

const MermaidDiagram = lazy(diagramRenderers.mermaid.load);

export function RedrawStage() {
	const hydrated = useHydrated();
	const pending = <p className="text-sm text-muted-foreground">正在渲染 Mermaid 图…</p>;
	return (
		<div className="mx-auto w-full max-w-3xl">
			{hydrated ? (
				<Suspense fallback={pending}>
					<MermaidDiagram format="mermaid" source={MERMAID_DIAGRAM} />
				</Suspense>
			) : (
				pending
			)}
			<p className="mt-3 text-xs text-muted-foreground">
				站点文章里的 Mermaid 图块走的就是这条管线：Mermaid 布局，inkSvg 换成 G
				笔草稿手法的笔触。
			</p>
		</div>
	);
}

const PALETTE_THEMES = [
	{ value: "site", label: "跟随站点" },
	{ value: "light", label: "浅色" },
	{ value: "dark", label: "深色" },
] as const;

function usePaletteTheme(): DemoTheme {
	const choice = useWorkbenchStore((s) => s.paletteTheme);
	const site = useSiteAppearance();
	return choice === "site" ? site : choice;
}

export function PaletteStage() {
	const theme = usePaletteTheme();
	const lineWash = useMemo(() => draw(lineWashExample.scene, lineWashExample.options), []);
	return (
		<Figure className="mx-auto w-full max-w-lg">
			<DrawingView
				drawing={lineWash}
				palette={themedPalette(lineWashExample.palette, theme)}
				label="换色前后几何不变的线描淡彩画面"
				className="aspect-400/280 overflow-hidden rounded-2xl"
			/>
		</Figure>
	);
}

export function PaletteParams() {
	const choice = useWorkbenchStore((s) => s.paletteTheme);
	const set = useWorkbenchStore((s) => s.set);
	const theme = usePaletteTheme();
	const palette = themedPalette(lineWashExample.palette, theme);
	return (
		<div className="grid gap-4">
			<Segmented
				aria-label="配色"
				block
				value={choice}
				onValueChange={(value) => set({ paletteTheme: value })}
				segments={[...PALETTE_THEMES]}
			/>
			<ul className="grid gap-1.5 text-xs">
				{Object.entries(palette).map(([role, color]) => (
					<li key={role} className="flex items-center gap-2">
						<span
							aria-hidden
							className="size-4 rounded-sm border border-border"
							style={{ background: color }}
						/>
						<span className="font-mono">{role}</span>
						<span className="ml-auto font-mono text-muted-foreground">{color}</span>
					</li>
				))}
			</ul>
			<p className="text-xs leading-relaxed text-muted-foreground">
				画面只记录颜色角色。切换时调用 updateSvgPalette，按角色改写颜色，笔画不重新生成。
			</p>
		</div>
	);
}
