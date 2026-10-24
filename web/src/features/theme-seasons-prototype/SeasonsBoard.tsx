/**
 * PROTOTYPE（#645）：四季主题并排对照板。每个方向都用真实站点数据渲染一段首页切片，左浅右深。
 */
import { Epigraph } from "@shared/ui/epigraph";
import { Button, Checkbox, Switch } from "@violet/ui";
import { useRecentPublications, useSiteIdentity } from "@widgets/HomeExperience/api/queries";
import { cn } from "cn";
import { ArrowRight, Check, Copy, RotateCcw } from "lucide-react";
import { useState } from "react";

import {
	DIRECTIONS,
	type Direction,
	SEASON_BY_KEY,
	SEASONS,
	SETS,
	type SeasonKey,
} from "./directions";
import { usePrototype, useTuned } from "./store";
import { foregroundKind, scalesOf, themeCssAt, wcag } from "./theme-css";

type Contrast = "standard" | "more";
type Tab = "overview" | SeasonKey;

const FALLBACK_POSTS = [
	"Violet 与 Yggdrasil 性能实测：首屏速度与长文并发",
	"kite 开发进度看板",
	"Inkline：给 SVG 和 Canvas 一支「像人在画」的笔",
];

function ScopedTheme({ direction, contrast }: { direction: Direction; contrast: Contrast }) {
	const { seed, neutralChroma } = useTuned(direction.id);
	return (
		<style>
			{themeCssAt(seed, neutralChroma, `[data-theme="proto-${direction.id}"]`, contrast)}
		</style>
	);
}

function Backdrop() {
	return (
		<div aria-hidden className="pointer-events-none absolute inset-0">
			<div className="absolute inset-0 bg-[radial-gradient(36rem_24rem_at_100%_0%,var(--brand-a3),transparent_72%)]" />
			<div className="absolute inset-0 bg-[radial-gradient(circle,var(--neutral-a5)_1px,transparent_1.5px)] bg-size-[24px_24px] mask-[radial-gradient(ellipse_62%_68%_at_50%_46%,transparent_34%,#000_96%)]" />
		</div>
	);
}

/** 首页切片：顶栏、序章、近稿与常用控件。 */
function Specimen({
	direction,
	appearance,
}: {
	direction: Direction;
	appearance: "light" | "dark";
}) {
	const identity = useSiteIdentity().data;
	const posts = useRecentPublications().data?.data ?? [];
	const titles = posts.length > 0 ? posts.slice(0, 3).map((post) => post.title) : FALLBACK_POSTS;
	const owner = identity?.owner_name ?? "xunrua";
	return (
		<div
			data-theme={`proto-${direction.id}`}
			className={cn(
				"dialect-public relative isolate min-w-0 overflow-hidden rounded-2xl ring-1 ring-border",
				appearance === "dark" && "dark",
			)}
		>
			<Backdrop />
			<div className="relative space-y-7 p-6">
				<div className="flex items-center justify-between gap-3">
					<span className="flex h-8 items-center gap-2 rounded-full border border-border/60 bg-background/80 px-2.5">
						<span className="size-4.5 rounded-full bg-selected ring-1 ring-border/50" />
						<span className="font-mono text-[10px] font-bold tracking-[0.14em] text-foreground">
							VIOLET
						</span>
					</span>
					<span className="flex items-center gap-0.5 rounded-full bg-muted/70 p-0.5 text-[11px]">
						<span className="rounded-full bg-background px-2.5 py-1 text-foreground">
							首页
						</span>
						<span className="px-2.5 py-1 text-muted-foreground">博客</span>
						<span className="px-2.5 py-1 text-muted-foreground">系列</span>
					</span>
				</div>

				<div className="space-y-4">
					<h3 className="text-3xl font-normal tracking-[-0.03em] text-foreground">
						Hi, I&apos;m{" "}
						<span className="font-medium text-primary underline decoration-primary/35 decoration-wavy underline-offset-8">
							{owner}
						</span>
						.
					</h3>
					{identity?.hero.quote ? (
						<Epigraph
							quote={identity.hero.quote}
							translation={identity.hero.quote_translation ?? undefined}
							author={identity.hero.quote_author ?? undefined}
							variant="accent-line"
							captionAlign="end"
							className="text-sm"
						/>
					) : null}
				</div>

				<div>
					<p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground/60 uppercase">
						Fresh ink
					</p>
					<p className="mt-1 font-serif text-lg tracking-[0.08em] text-foreground/85">
						近稿
					</p>
					<ol className="relative mt-2">
						<span
							aria-hidden
							className="absolute inset-y-4 left-3 w-px bg-linear-to-b from-primary/70 via-border to-transparent"
						/>
						{titles.map((title, index) => (
							<li key={title} className="relative py-2.5 pl-9">
								<span
									className={cn(
										"absolute top-2.5 left-3 -translate-x-1/2 bg-background px-1 font-mono text-[10px] leading-5",
										index === 0 ? "text-primary" : "text-muted-foreground/55",
									)}
								>
									{String(index + 1).padStart(2, "0")}
								</span>
								<p
									className={cn(
										"font-serif text-foreground",
										index === 0
											? "text-base leading-6"
											: "text-sm leading-5 text-foreground/85",
										index === 1 && "text-link underline underline-offset-4",
									)}
								>
									{title}
								</p>
								{index === 1 ? (
									<p className="text-[10px] text-muted-foreground">
										↑ 悬停时标题变为链接色
									</p>
								) : null}
							</li>
						))}
					</ol>
				</div>

				<div className="flex flex-wrap items-center gap-2.5">
					<Button size="sm">订阅更新</Button>
					<Button size="sm" variant="outline">
						浏览归档
					</Button>
					<span className="inline-flex items-center gap-1 text-xs text-link">
						尽览新篇 <ArrowRight className="size-3.5" />
					</span>
				</div>

				<div className="flex flex-wrap items-center gap-3">
					<span className="flex h-8 w-36 items-center rounded-md border border-ring bg-background px-2.5 text-xs text-muted-foreground ring-[3px] ring-ring/40">
						搜索文章…
					</span>
					<Checkbox checked aria-label="示例复选框" />
					<Switch checked aria-label="示例开关" />
					<span className="inline-flex h-6 items-center rounded-full bg-selected px-2.5 text-[11px] text-selected-foreground">
						已选标签
					</span>
					<span className="inline-flex h-6 items-center rounded-full bg-muted px-2.5 text-[11px] text-muted-foreground">
						标签
					</span>
				</div>

				<div className="flex flex-wrap items-center gap-4 text-[11px]">
					<span className="text-success-text">● 已发布</span>
					<span className="text-warning-text">● 待审核</span>
					<span className="text-destructive-text">● 发布失败</span>
					<span className="text-muted-foreground">状态色不随主题变化</span>
				</div>
			</div>
		</div>
	);
}

function Facts({ direction, contrast }: { direction: Direction; contrast: Contrast }) {
	const { seed, neutralChroma } = useTuned(direction.id);
	const light = scalesOf(seed, neutralChroma, "light", contrast);
	const dark = scalesOf(seed, neutralChroma, "dark", contrast);
	const rows: [string, string][] = [
		[
			"实色",
			`${foregroundKind(light)} · ${wcag(light.brand.steps[9], light.brand.contrast).toFixed(2)}:1`,
		],
		[
			"链接（浅 / 深）",
			`${wcag(light.brand.steps[11], light.neutral.steps[1]).toFixed(2)} / ${wcag(dark.brand.steps[11], dark.neutral.steps[1]).toFixed(2)}`,
		],
		[
			"正文（浅 / 深）",
			`${wcag(light.neutral.steps[12], light.neutral.steps[1]).toFixed(2)} / ${wcag(dark.neutral.steps[12], dark.neutral.steps[1]).toFixed(2)}`,
		],
		[
			"主色当文字（浅 / 深）",
			`${wcag(light.brand.steps[9], light.neutral.steps[1]).toFixed(2)} / ${wcag(dark.brand.steps[9], dark.neutral.steps[1]).toFixed(2)}`,
		],
	];
	return (
		<dl className="grid gap-1.5 text-xs">
			{rows.map(([label, value]) => (
				<div key={label} className="flex justify-between gap-4">
					<dt className="text-muted-foreground">{label}</dt>
					<dd className="font-mono tabular-nums">{value}</dd>
				</div>
			))}
		</dl>
	);
}

function Tuner({ direction }: { direction: Direction }) {
	const { seed, neutralChroma } = useTuned(direction.id);
	const tune = usePrototype((state) => state.tune);
	const reset = usePrototype((state) => state.resetTuning);
	const tuned = usePrototype((state) => Boolean(state.tuning[direction.id]));
	const [draft, setDraft] = useState<string | null>(null);
	return (
		<div className="space-y-3">
			<div className="flex items-center gap-2">
				<input
					type="color"
					aria-label={`${direction.name} 种子色`}
					value={seed}
					onChange={(event) => {
						tune(direction.id, { seed: event.target.value });
						setDraft(null);
					}}
					className="size-8 shrink-0 cursor-pointer rounded-md border border-input bg-transparent"
				/>
				<input
					aria-label={`${direction.name} 种子色十六进制`}
					value={draft ?? seed}
					onChange={(event) => {
						setDraft(event.target.value);
						if (/^#[0-9a-f]{6}$/i.test(event.target.value))
							tune(direction.id, { seed: event.target.value.toLowerCase() });
					}}
					className="h-8 w-24 rounded-md border border-input bg-background px-2 font-mono text-xs focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
				/>
				{tuned ? (
					<button
						type="button"
						onClick={() => {
							reset(direction.id);
							setDraft(null);
						}}
						className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
					>
						<RotateCcw className="size-3.5" />
						还原
					</button>
				) : null}
			</div>
			<label className="block">
				<span className="flex justify-between text-xs text-muted-foreground">
					中性色调
					<span className="font-mono tabular-nums">{neutralChroma.toFixed(3)}</span>
				</span>
				<input
					type="range"
					min={0}
					max={0.05}
					step={0.001}
					value={neutralChroma}
					onChange={(event) =>
						tune(direction.id, { neutralChroma: Number(event.target.value) })
					}
					className="mt-1.5 w-full accent-(--brand-9)"
				/>
			</label>
		</div>
	);
}

function PickButton({ direction }: { direction: Direction }) {
	const picked = usePrototype((state) => state.picks[direction.season] === direction.key);
	const setPick = usePrototype((state) => state.setPick);
	return (
		<button
			type="button"
			aria-pressed={picked}
			onClick={() => setPick(direction.season, direction.key)}
			className={cn(
				"inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
				picked
					? "border-transparent bg-foreground text-background"
					: "border-border text-muted-foreground hover:text-foreground",
			)}
		>
			{picked ? <Check className="size-3.5" /> : null}
			{picked ? "已选" : "选这个"}
		</button>
	);
}

function labelOf(direction: Direction): string {
	return direction.group ?? SETS[direction.key as keyof typeof SETS].name;
}

function DirectionRow({ direction, contrast }: { direction: Direction; contrast: Contrast }) {
	return (
		<section className="grid gap-8 border-t border-border py-12 lg:grid-cols-[16rem_1fr]">
			<div className="space-y-6">
				<div>
					<p className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground">
						{direction.key} · {labelOf(direction)}
					</p>
					<h3 className="mt-2 font-serif text-4xl tracking-widest">{direction.name}</h3>
					<p className="mt-3 text-sm leading-6 text-muted-foreground">{direction.note}</p>
				</div>
				<PickButton direction={direction} />
				<Tuner direction={direction} />
				<Facts direction={direction} contrast={contrast} />
			</div>
			<div className="grid min-w-0 gap-4 xl:grid-cols-2">
				<Specimen direction={direction} appearance="light" />
				<Specimen direction={direction} appearance="dark" />
			</div>
		</section>
	);
}

/** 总览卡：一个方向的浅深两半，主按钮、链接、选中与 12 档色阶。 */
function OverviewCard({ direction }: { direction: Direction }) {
	const { seed, neutralChroma } = useTuned(direction.id);
	const picked = usePrototype((state) => state.picks[direction.season] === direction.key);
	const setPick = usePrototype((state) => state.setPick);
	return (
		<button
			type="button"
			aria-pressed={picked}
			onClick={() => setPick(direction.season, direction.key)}
			className={cn(
				"group min-w-0 rounded-2xl p-1.5 text-left ring-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
				picked ? "ring-2 ring-foreground" : "ring-border hover:ring-foreground/40",
			)}
		>
			<div className="grid grid-cols-2 overflow-hidden rounded-xl">
				{(["light", "dark"] as const).map((appearance) => {
					const scales = scalesOf(seed, neutralChroma, appearance);
					return (
						<div
							key={appearance}
							data-theme={`proto-${direction.id}`}
							className={cn(
								"dialect-public space-y-3 p-4",
								appearance === "dark" && "dark",
							)}
						>
							<p className="font-serif text-2xl leading-none text-link">
								{SEASON_BY_KEY[direction.season].label}
							</p>
							<span className="inline-flex h-7 items-center rounded-md bg-primary px-2.5 text-xs text-primary-foreground">
								订阅
							</span>
							<p className="text-xs text-link">链接文字</p>
							<span className="inline-flex h-5 items-center rounded-full bg-selected px-2 text-[10px] text-selected-foreground">
								已选
							</span>
							<span aria-hidden className="flex overflow-hidden rounded">
								{([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const).map((step) => (
									<span
										key={step}
										className="h-2 flex-1"
										style={{ background: scales.brand.steps[step] }}
									/>
								))}
							</span>
						</div>
					);
				})}
			</div>
			<div className="flex items-baseline justify-between px-2.5 pt-3 pb-1.5">
				<span className="font-serif text-base tracking-widest">
					{direction.name}
					<span className="ml-2 font-sans text-[11px] tracking-normal text-muted-foreground">
						{direction.key} · {labelOf(direction)}
					</span>
				</span>
				<span className="font-mono text-[11px] text-muted-foreground">{seed}</span>
			</div>
		</button>
	);
}

function Overview() {
	return (
		<div className="space-y-14">
			{SEASONS.map((season) => (
				<div key={season.key} className="grid gap-5 lg:grid-cols-[9rem_1fr]">
					<div>
						<p className="font-serif text-5xl leading-none">{season.label}</p>
						<p className="mt-3 font-serif text-sm tracking-widest text-foreground/85">
							{season.greeting[0]}
						</p>
						<p className="mt-1 text-xs text-muted-foreground">{season.months}</p>
					</div>
					<div className="grid gap-5 sm:grid-cols-3">
						{DIRECTIONS.filter((direction) => direction.season === season.key).map(
							(direction) => (
								<OverviewCard key={direction.id} direction={direction} />
							),
						)}
					</div>
				</div>
			))}
		</div>
	);
}

function Summary() {
	const picks = usePrototype((state) => state.picks);
	const tuning = usePrototype((state) => state.tuning);
	const entry = usePrototype((state) => state.entry);
	const layers = usePrototype((state) => state.layers);
	const [copied, setCopied] = useState(false);
	const lines = SEASONS.map((season) => {
		const direction = DIRECTIONS.find(
			(item) => item.season === season.key && item.key === picks[season.key],
		);
		if (!direction) return "";
		const seed = tuning[direction.id]?.seed ?? direction.seed;
		const neutralChroma = tuning[direction.id]?.neutralChroma ?? direction.neutralChroma;
		return `${season.label}  ${direction.key} ${direction.name}  seed ${seed}  neutralChroma ${neutralChroma}`;
	});
	const kept = [
		layers.illustration && "插画",
		layers.particles && "飘落",
		layers.ornaments && "挂件",
	].filter(Boolean);
	const text = [...lines, `入口 ${entry}  装饰 ${kept.join("、") || "无"}`].join("\n");
	return (
		<section className="mt-20 rounded-2xl bg-muted/60 p-6 sm:p-8">
			<div className="flex items-start justify-between gap-4">
				<div>
					<h2 className="text-xl">当前选择</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						总览里点卡片或在各季里点「选这个」；微调过的值也会带上。可整段贴回 #645。
					</p>
				</div>
				<Button
					size="sm"
					variant="outline"
					onClick={() => {
						void navigator.clipboard.writeText(text).then(() => {
							setCopied(true);
							window.setTimeout(() => setCopied(false), 1600);
						});
					}}
				>
					{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
					{copied ? "已复制" : "复制"}
				</Button>
			</div>
			<pre className="mt-5 overflow-x-auto font-mono text-xs leading-6 text-foreground">
				{text}
			</pre>
		</section>
	);
}

export function SeasonsBoard() {
	const [tab, setTab] = useState<Tab>("winter");
	const [contrast, setContrast] = useState<Contrast>("standard");
	const tabs: { value: Tab; label: string }[] = [
		{ value: "overview", label: "总览" },
		...SEASONS.map((season) => ({ value: season.key as Tab, label: season.label })),
	];
	return (
		<div className="mx-auto w-full max-w-7xl px-5 pt-16 pb-40 sm:px-8 lg:px-12">
			{DIRECTIONS.map((direction) => (
				<ScopedTheme key={direction.id} direction={direction} contrast={contrast} />
			))}
			<header className="max-w-3xl">
				<p className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground">
					PROTOTYPE · #645
				</p>
				<h1 className="mt-4 text-5xl font-normal tracking-[-0.03em]">四季主题</h1>
				<p className="mt-5 text-base leading-7 text-muted-foreground">
					每季三个方向，全部由 @violetjs/theme
					从一个种子色生成。每个方向左浅右深，内容取自本站数据。可以直接改种子色和中性色调；选中的方向会同时应用到整站，底部切换条可切到其他页面看效果。
				</p>
			</header>

			<div className="sticky top-14 z-30 -mx-2 mt-12 flex flex-wrap items-center justify-between gap-3 bg-background/85 px-2 py-3 backdrop-blur-md">
				<div role="tablist" aria-label="季节" className="flex gap-1">
					{tabs.map((item) => (
						<button
							key={item.value}
							type="button"
							role="tab"
							aria-selected={tab === item.value}
							onClick={() => setTab(item.value)}
							className={cn(
								"h-9 rounded-full px-4 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
								tab === item.value
									? "bg-foreground text-background"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							{item.label}
						</button>
					))}
				</div>
				<div
					role="radiogroup"
					aria-label="对比度"
					className="flex items-center gap-1 text-xs"
				>
					<span className="mr-1 text-muted-foreground">对比度</span>
					{(["standard", "more"] as const).map((value) => (
						<button
							key={value}
							type="button"
							role="radio"
							aria-checked={contrast === value}
							onClick={() => setContrast(value)}
							className={cn(
								"h-8 rounded-full px-3 transition-colors",
								contrast === value
									? "bg-muted text-foreground"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							{value === "standard" ? "标准" : "提高"}
						</button>
					))}
				</div>
			</div>

			<div className="mt-10">
				{tab === "overview" ? (
					<Overview />
				) : (
					<>
						<div className="mb-4 flex items-baseline gap-5">
							<p className="font-serif text-6xl leading-none">
								{SEASON_BY_KEY[tab].label}
							</p>
							<p className="font-serif text-lg tracking-widest text-foreground/85">
								{SEASON_BY_KEY[tab].greeting.join(" · ")}
							</p>
							<p className="text-sm text-muted-foreground">
								{SEASON_BY_KEY[tab].months}
							</p>
						</div>
						{DIRECTIONS.filter((direction) => direction.season === tab).map(
							(direction) => (
								<DirectionRow
									key={direction.id}
									direction={direction}
									contrast={contrast}
								/>
							),
						)}
					</>
				)}
			</div>

			<Summary />
		</div>
	);
}
