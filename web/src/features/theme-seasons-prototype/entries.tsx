/**
 * PROTOTYPE（#645）：三种主题切换入口。
 *
 * A 外观面板：顶栏操作区原外观开关的位置换成一个按钮，面板里集中外观、主题与装饰。
 * B 季节印章：Logo 旁常驻一枚季节印章，点开是四季卡片。
 * C 页脚：顶栏不变，页脚加一行主题与装饰选择（另在命令面板提供同名命令）。
 */
import { useAppearanceSwitcher } from "@features/appearance";
import { Switch } from "@violet/ui";
import { cn } from "cn";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { useState } from "react";

import {
	currentSeason,
	currentSolarTerm,
	directionOf,
	SEASON_BY_KEY,
	SEASONS,
	type SeasonKey,
} from "./directions";
import { type DecoPref, resolveSeason, type ThemePref, usePrototype, useTuned } from "./store";
import { scalesOf, themeCss } from "./theme-css";

// —— 共用 ——

function useSeasonDirection(season: SeasonKey) {
	const pick = usePrototype((state) => state.picks[season]);
	const direction = directionOf(season, pick);
	const tuned = useTuned(direction.id);
	return { direction, ...tuned };
}

/** 种子生成的品牌实色圆点：左半浅色外观、右半深色外观。 */
function Swatch({
	seed,
	neutralChroma,
	className,
}: {
	seed: string;
	neutralChroma: number;
	className?: string;
}) {
	const light = scalesOf(seed, neutralChroma, "light");
	const dark = scalesOf(seed, neutralChroma, "dark");
	return (
		<span
			aria-hidden
			className={cn(
				"inline-block shrink-0 rounded-full ring-1 ring-edge-hairline",
				className,
			)}
			style={{
				background: `linear-gradient(90deg, ${light.brand.steps[9]} 50%, ${dark.brand.steps[9]} 50%)`,
			}}
		/>
	);
}

function SeasonSwatch({ season, className }: { season: SeasonKey; className?: string }) {
	const { seed, neutralChroma } = useSeasonDirection(season);
	return <Swatch seed={seed} neutralChroma={neutralChroma} className={className} />;
}

function ActiveSwatch({ className }: { className?: string }) {
	const themePref = usePrototype((state) => state.themePref);
	const customSeed = usePrototype((state) => state.customSeed);
	const season = resolveSeason(themePref);
	return season ? (
		<SeasonSwatch season={season} className={className} />
	) : (
		<Swatch seed={customSeed} neutralChroma={0.015} className={className} />
	);
}

const PANEL_CLASS =
	"dialect-public z-50 rounded-2xl border border-border bg-popover text-popover-foreground shadow-[0_4px_24px_rgb(0_0_0/0.05)] outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0";

function SectionLabel({ children }: { children: React.ReactNode }) {
	return <p className="mb-2 text-xs font-medium text-muted-foreground">{children}</p>;
}

/** 自定义种子色：取色、十六进制输入与按钮、链接、选中态的实时预览。 */
function CustomSeedEditor() {
	const customSeed = usePrototype((state) => state.customSeed);
	const setCustomSeed = usePrototype((state) => state.setCustomSeed);
	const [draft, setDraft] = useState(customSeed);
	const scopeId = "proto-custom-preview";
	return (
		<div className="space-y-3 rounded-xl bg-muted/60 p-3">
			<div className="flex items-center gap-2">
				<input
					type="color"
					aria-label="选择种子色"
					value={customSeed}
					onChange={(event) => {
						setCustomSeed(event.target.value);
						setDraft(event.target.value);
					}}
					className="size-8 shrink-0 cursor-pointer rounded-md border border-input bg-transparent"
				/>
				<input
					aria-label="种子色十六进制"
					value={draft}
					onChange={(event) => {
						setDraft(event.target.value);
						if (/^#[0-9a-f]{6}$/i.test(event.target.value))
							setCustomSeed(event.target.value.toLowerCase());
					}}
					className="h-8 w-28 rounded-md border border-input bg-background px-2 font-mono text-xs focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
				/>
				<span className="text-[11px] text-muted-foreground">任意颜色都会调到可读</span>
			</div>
			<style>{themeCss(customSeed, 0.015, `[data-theme="${scopeId}"]`)}</style>
			<div
				data-theme={scopeId}
				className="dialect-public flex items-center gap-3 rounded-lg bg-background p-2.5"
			>
				<span className="inline-flex h-7 items-center rounded-md bg-primary px-2.5 text-xs text-primary-foreground">
					主要按钮
				</span>
				<span className="text-xs text-link underline underline-offset-2">链接文字</span>
				<span className="inline-flex h-6 items-center rounded-full bg-selected px-2 text-[11px] text-selected-foreground">
					已选中
				</span>
			</div>
		</div>
	);
}

const DECO_OPTIONS: { value: DecoPref; label: string }[] = [
	{ value: "follow", label: "跟随主题" },
	{ value: "none", label: "无" },
	...SEASONS.map((season) => ({ value: season.key as DecoPref, label: season.label })),
];

function DecoChips({ size = "sm" }: { size?: "sm" | "xs" }) {
	const decoPref = usePrototype((state) => state.decoPref);
	const setDecoPref = usePrototype((state) => state.setDecoPref);
	return (
		<div role="radiogroup" aria-label="装饰" className="flex flex-wrap gap-1.5">
			{DECO_OPTIONS.map((option) => (
				<button
					key={option.value}
					type="button"
					role="radio"
					aria-checked={decoPref === option.value}
					onClick={() => setDecoPref(option.value)}
					className={cn(
						"rounded-full border px-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
						size === "sm" ? "h-7 text-xs" : "h-6 text-[11px]",
						decoPref === option.value
							? "border-transparent bg-selected text-selected-foreground"
							: "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
					)}
				>
					{option.label}
				</button>
			))}
		</div>
	);
}

// —— A 外观面板 ——

const APPEARANCES = [
	{ value: "light", label: "浅色", icon: Sun },
	{ value: "dark", label: "深色", icon: Moon },
	{ value: "system", label: "跟随系统", icon: Monitor },
] as const;

function AppearanceRow() {
	const { appearance, switchAppearance } = useAppearanceSwitcher();
	return (
		<div
			role="radiogroup"
			aria-label="外观"
			className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1"
		>
			{APPEARANCES.map(({ value, label, icon: Icon }) => (
				<button
					key={value}
					type="button"
					role="radio"
					aria-checked={appearance === value}
					onClick={(event) => switchAppearance(value, event)}
					className={cn(
						"flex h-8 items-center justify-center gap-1.5 rounded-lg text-xs transition-colors focus-visible:outline-2 focus-visible:outline-ring",
						appearance === value
							? "bg-background text-foreground"
							: "text-muted-foreground hover:text-foreground",
					)}
				>
					<Icon className="size-3.5" />
					{label}
				</button>
			))}
		</div>
	);
}

function ThemeTile({ pref, children }: { pref: ThemePref; children: React.ReactNode }) {
	const themePref = usePrototype((state) => state.themePref);
	const setThemePref = usePrototype((state) => state.setThemePref);
	const active = themePref === pref;
	return (
		<button
			type="button"
			role="radio"
			aria-checked={active}
			onClick={() => setThemePref(pref)}
			className={cn(
				"flex min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
				active
					? "border-ring bg-selected text-selected-foreground"
					: "border-border hover:bg-muted",
			)}
		>
			{children}
		</button>
	);
}

export function EntryPanel({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
	const themePref = usePrototype((state) => state.themePref);
	const now = currentSeason();
	const nowDirection = useSeasonDirection(now).direction;
	return (
		<PopoverPrimitive.Root onOpenChange={onOpenChange}>
			<PopoverPrimitive.Trigger
				aria-label="外观与主题"
				className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring data-[state=open]:bg-muted"
			>
				<ActiveSwatch className="size-4" />
			</PopoverPrimitive.Trigger>
			<PopoverPrimitive.Portal>
				<PopoverPrimitive.Content
					align="end"
					sideOffset={12}
					className={cn(PANEL_CLASS, "w-84 p-4")}
				>
					<SectionLabel>外观</SectionLabel>
					<AppearanceRow />
					<div className="mt-5">
						<SectionLabel>主题</SectionLabel>
						<div
							role="radiogroup"
							aria-label="主题"
							className="grid grid-cols-2 gap-1.5"
						>
							<div className="col-span-2 grid">
								<ThemeTile pref="follow">
									<SeasonSwatch season={now} className="size-5" />
									<span className="min-w-0 flex-1">
										<span className="block text-sm">跟随季节</span>
										<span className="block text-[11px] text-muted-foreground">
											现在是{SEASON_BY_KEY[now].label} · {nowDirection.name} ·{" "}
											{currentSolarTerm()}
										</span>
									</span>
									{themePref === "follow" && <Check className="size-4" />}
								</ThemeTile>
							</div>
							{SEASONS.map((season) => (
								<SeasonTile key={season.key} season={season.key} />
							))}
							<div className="col-span-2 grid">
								<ThemeTile pref="custom">
									<span
										aria-hidden
										className="size-5 shrink-0 rounded-full bg-[conic-gradient(from_0deg,oklch(0.7_0.15_0),oklch(0.7_0.15_120),oklch(0.7_0.15_240),oklch(0.7_0.15_360))]"
									/>
									<span className="flex-1 text-sm">自定义</span>
									{themePref === "custom" && <Check className="size-4" />}
								</ThemeTile>
							</div>
						</div>
						{themePref === "custom" && (
							<div className="mt-2">
								<CustomSeedEditor />
							</div>
						)}
					</div>
					<div className="mt-5">
						<SectionLabel>季节装饰</SectionLabel>
						<DecoChips />
					</div>
				</PopoverPrimitive.Content>
			</PopoverPrimitive.Portal>
		</PopoverPrimitive.Root>
	);
}

function SeasonTile({ season }: { season: SeasonKey }) {
	const { direction } = useSeasonDirection(season);
	return (
		<ThemeTile pref={season}>
			<SeasonSwatch season={season} className="size-5" />
			<span className="text-sm">{SEASON_BY_KEY[season].label}</span>
			<span className="truncate text-[11px] text-muted-foreground">{direction.name}</span>
		</ThemeTile>
	);
}

// —— B 季节印章 ——

function SeasonCard({ season }: { season: SeasonKey }) {
	const themePref = usePrototype((state) => state.themePref);
	const setThemePref = usePrototype((state) => state.setThemePref);
	const { direction, seed, neutralChroma } = useSeasonDirection(season);
	const scales = scalesOf(seed, neutralChroma, "light");
	const info = SEASON_BY_KEY[season];
	const active = themePref === season;
	const isNow = currentSeason() === season;
	return (
		<button
			type="button"
			role="radio"
			aria-checked={active}
			onClick={() => setThemePref(season)}
			className={cn(
				"group relative flex flex-col items-start gap-3 rounded-xl border p-3.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
				active ? "border-ring bg-selected" : "border-border hover:bg-muted/70",
			)}
		>
			<span className="flex w-full items-start justify-between">
				<span
					className="font-serif text-3xl leading-none"
					style={{ color: scales.brand.steps[11] }}
				>
					{info.label}
				</span>
				{isNow && (
					<span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
						当季
					</span>
				)}
			</span>
			<span className="space-y-0.5">
				<span className="block font-serif text-sm tracking-widest text-foreground">
					{info.greeting[0]}
				</span>
				<span className="block text-[11px] text-muted-foreground">
					{direction.name} · {info.months}
				</span>
			</span>
			<span aria-hidden className="flex w-full overflow-hidden rounded-md">
				{([3, 6, 9, 11] as const).map((step) => (
					<span
						key={step}
						className="h-2 flex-1"
						style={{ background: scales.brand.steps[step] }}
					/>
				))}
			</span>
		</button>
	);
}

export function EntrySeal() {
	const themePref = usePrototype((state) => state.themePref);
	const setThemePref = usePrototype((state) => state.setThemePref);
	const decoPref = usePrototype((state) => state.decoPref);
	const setDecoPref = usePrototype((state) => state.setDecoPref);
	const season = resolveSeason(themePref);
	const label = season ? SEASON_BY_KEY[season].label : "自";
	const following = themePref === "follow";
	return (
		<PopoverPrimitive.Root>
			<PopoverPrimitive.Trigger
				aria-label={`主题：${following ? "跟随季节，" : ""}${season ? SEASON_BY_KEY[season].label : "自定义"}`}
				className="dialect-public pointer-events-auto flex h-10 items-center gap-2 rounded-full border border-border/60 bg-background/80 pr-3 pl-2 backdrop-blur-md transition-colors hover:border-border hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[state=open]:border-border data-[state=open]:bg-muted/50"
			>
				<span className="flex size-6 items-center justify-center rounded-md bg-primary font-serif text-sm leading-none text-primary-foreground">
					{label}
				</span>
				<span className="text-xs text-muted-foreground">
					{season
						? directionOf(season, usePrototype.getState().picks[season]).name
						: "自定义"}
				</span>
			</PopoverPrimitive.Trigger>
			<PopoverPrimitive.Portal>
				<PopoverPrimitive.Content
					align="start"
					sideOffset={10}
					className={cn(PANEL_CLASS, "w-100 p-5")}
				>
					<div className="flex items-center justify-between">
						<div>
							<p className="font-serif text-lg tracking-widest">四季</p>
							<p className="text-xs text-muted-foreground">站点颜色随季节更替</p>
						</div>
						<div className="flex items-center gap-2 text-xs text-muted-foreground">
							跟随季节
							<Switch
								aria-label="跟随季节"
								checked={following}
								onCheckedChange={(checked) =>
									setThemePref(checked ? "follow" : (season ?? currentSeason()))
								}
							/>
						</div>
					</div>
					<div
						role="radiogroup"
						aria-label="季节"
						className="mt-4 grid grid-cols-2 gap-2"
					>
						{SEASONS.map((item) => (
							<SeasonCard key={item.key} season={item.key} />
						))}
					</div>
					<div className="mt-3">
						<button
							type="button"
							role="radio"
							aria-checked={themePref === "custom"}
							onClick={() => setThemePref("custom")}
							className={cn(
								"flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring",
								themePref === "custom"
									? "border-ring bg-selected"
									: "border-border hover:bg-muted/70",
							)}
						>
							自定义种子色
							{themePref === "custom" && <Check className="size-4" />}
						</button>
						{themePref === "custom" && (
							<div className="mt-2">
								<CustomSeedEditor />
							</div>
						)}
					</div>
					<div className="mt-4 flex items-center justify-between border-t border-border pt-4">
						<span className="text-sm">季节装饰</span>
						<Switch
							checked={decoPref !== "none"}
							onCheckedChange={(checked) => setDecoPref(checked ? "follow" : "none")}
						/>
					</div>
				</PopoverPrimitive.Content>
			</PopoverPrimitive.Portal>
		</PopoverPrimitive.Root>
	);
}

// —— C 页脚 ——

export function EntryFooter() {
	const themePref = usePrototype((state) => state.themePref);
	const setThemePref = usePrototype((state) => state.setThemePref);
	const now = currentSeason();
	const options: { value: ThemePref; label: string; season?: SeasonKey }[] = [
		{ value: "follow", label: `跟随季节 · ${SEASON_BY_KEY[now].label}`, season: now },
		...SEASONS.map((season) => ({
			value: season.key as ThemePref,
			label: season.label,
			season: season.key,
		})),
		{ value: "custom", label: "自定义" },
	];
	return (
		<div className="mt-10">
			<div className="flex flex-col gap-4 border-t border-border/60 pt-6 sm:flex-row sm:items-start sm:gap-10">
				<div className="sm:w-28">
					<p className="text-xs font-medium text-foreground">主题</p>
					<p className="mt-1 text-[11px] text-muted-foreground">⌘K 输入「主题」</p>
				</div>
				<div className="flex-1 space-y-3">
					<div role="radiogroup" aria-label="主题" className="flex flex-wrap gap-1.5">
						{options.map((option) => (
							<button
								key={option.value}
								type="button"
								role="radio"
								aria-checked={themePref === option.value}
								onClick={() => setThemePref(option.value)}
								className={cn(
									"flex h-8 items-center gap-2 rounded-full border px-3 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
									themePref === option.value
										? "border-transparent bg-selected text-selected-foreground"
										: "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
								)}
							>
								{option.season ? (
									<SeasonSwatch season={option.season} className="size-3" />
								) : null}
								{option.label}
							</button>
						))}
					</div>
					{themePref === "custom" && (
						<div className="max-w-md">
							<CustomSeedEditor />
						</div>
					)}
					<div className="flex items-center gap-3">
						<span className="text-[11px] text-muted-foreground">装饰</span>
						<DecoChips size="xs" />
					</div>
				</div>
			</div>
		</div>
	);
}
