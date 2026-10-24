/**
 * PROTOTYPE（#645）：把样稿主题注入整站，并挂一条底部切换条。只在开发环境渲染。
 *
 * URL 参数：?entry=A|B|C&deco=pattern|light&set=A|B|C&theme=follow|spring|summer|autumn|winter
 */
import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";
import { useEffect } from "react";

import { useDecoration } from "./decorations";
import { type DirectionKey, directionOf, SEASON_BY_KEY, SETS } from "./directions";
import {
	type DecoVariant,
	type EntryVariant,
	resolveSeason,
	type ThemePref,
	usePrototype,
	useTuned,
} from "./store";
import { themeCss } from "./theme-css";

const THEME_CYCLE: ThemePref[] = ["follow", "spring", "summer", "autumn", "winter"];

function useActiveTheme() {
	const themePref = usePrototype((state) => state.themePref);
	const picks = usePrototype((state) => state.picks);
	const customSeed = usePrototype((state) => state.customSeed);
	const season = resolveSeason(themePref);
	const direction = season ? directionOf(season, picks[season]) : null;
	const tuned = useTuned(direction?.id ?? "spring-A");
	return direction
		? { id: direction.id, seed: tuned.seed, neutralChroma: tuned.neutralChroma }
		: { id: "custom", seed: customSeed, neutralChroma: 0.015 };
}

function useUrlSync() {
	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const state = usePrototype.getState();
		const entry = params.get("entry");
		if (entry === "A" || entry === "B" || entry === "C") state.setEntry(entry);
		const deco = params.get("deco");
		if (deco === "pattern" || deco === "light") state.setDeco(deco);
		const set = params.get("set");
		if (set === "A" || set === "B" || set === "C") state.setAllPicks(set);
		const theme = params.get("theme");
		if (theme && (THEME_CYCLE as string[]).includes(theme))
			state.setThemePref(theme as ThemePref);
	}, []);
}

function GlobalTheme() {
	const { id, seed, neutralChroma } = useActiveTheme();
	useEffect(() => {
		let style = document.getElementById("prototype-season-theme") as HTMLStyleElement | null;
		if (!style) {
			style = document.createElement("style");
			style.id = "prototype-season-theme";
			document.head.append(style);
		}
		style.textContent = themeCss(seed, neutralChroma, ":root:root");
		// 背景生命游戏监听根元素属性变化重新取色
		document.documentElement.dataset.prototypeTheme = `${id}:${seed}:${neutralChroma}`;
	}, [id, seed, neutralChroma]);
	const decoration = useDecoration();
	useEffect(() => {
		document.documentElement.dataset.prototypeDeco = `${decoration.variant}:${decoration.season ?? "none"}`;
	}, [decoration.variant, decoration.season]);
	return null;
}

function Choice<V extends string>({
	value,
	current,
	onSelect,
	children,
	title,
}: {
	value: V;
	current: V;
	onSelect: (value: V) => void;
	children: React.ReactNode;
	title?: string;
}) {
	const active = value === current;
	return (
		<button
			type="button"
			title={title}
			aria-pressed={active}
			onClick={() => onSelect(value)}
			className={cn(
				"h-7 rounded-full px-2.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
				active
					? "bg-background text-foreground"
					: "text-background/70 hover:text-background",
			)}
		>
			{children}
		</button>
	);
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex items-center gap-1">
			<span className="px-1.5 text-[11px] text-background/55">{label}</span>
			{children}
		</div>
	);
}

function PrototypeBar() {
	const themePref = usePrototype((state) => state.themePref);
	const setThemePref = usePrototype((state) => state.setThemePref);
	const picks = usePrototype((state) => state.picks);
	const setAllPicks = usePrototype((state) => state.setAllPicks);
	const entry = usePrototype((state) => state.entry);
	const setEntry = usePrototype((state) => state.setEntry);
	const deco = usePrototype((state) => state.deco);
	const setDeco = usePrototype((state) => state.setDeco);
	const season = resolveSeason(themePref);
	const uniformSet =
		new Set(Object.values(picks)).size === 1 ? picks.spring : ("mixed" as DirectionKey);

	const cycle = (step: number) => {
		const index = THEME_CYCLE.indexOf(themePref);
		setThemePref(THEME_CYCLE[(index + step + THEME_CYCLE.length) % THEME_CYCLE.length]);
	};

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
			if (event.metaKey || event.ctrlKey || event.altKey) return;
			if (event.key === "ArrowLeft") cycle(-1);
			if (event.key === "ArrowRight") cycle(1);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	const themeLabel =
		themePref === "custom"
			? "自定义"
			: themePref === "follow"
				? `跟随季节 · ${season ? SEASON_BY_KEY[season].label : ""}`
				: SEASON_BY_KEY[themePref].label;

	return (
		<div className="pointer-events-none fixed inset-x-0 bottom-4 z-9999 flex justify-center px-4">
			<div
				role="toolbar"
				aria-label="四季样稿切换条"
				className="pointer-events-auto flex max-w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-foreground px-2 py-1.5 text-background ring-1 ring-background/15"
			>
				<span className="px-1.5 font-mono text-[10px] tracking-[0.2em] text-background/50">
					原型
				</span>
				<div className="flex items-center">
					<button
						type="button"
						aria-label="上一个主题（←）"
						onClick={() => cycle(-1)}
						className="flex size-7 items-center justify-center rounded-full text-background/70 hover:text-background"
					>
						<ChevronLeft className="size-4" />
					</button>
					<span className="min-w-24 text-center text-xs tabular-nums">
						{themeLabel}
						{season ? ` · ${directionOf(season, picks[season]).name}` : ""}
					</span>
					<button
						type="button"
						aria-label="下一个主题（→）"
						onClick={() => cycle(1)}
						className="flex size-7 items-center justify-center rounded-full text-background/70 hover:text-background"
					>
						<ChevronRight className="size-4" />
					</button>
				</div>
				<Group label="方向">
					{(Object.keys(SETS) as DirectionKey[]).map((key) => (
						<Choice
							key={key}
							value={key}
							current={uniformSet}
							onSelect={setAllPicks}
							title={SETS[key].summary}
						>
							{key} {SETS[key].name}
						</Choice>
					))}
				</Group>
				<Group label="入口">
					{(["A", "B", "C"] as EntryVariant[]).map((key) => (
						<Choice key={key} value={key} current={entry} onSelect={setEntry}>
							{key} {{ A: "外观面板", B: "季节印章", C: "页脚" }[key]}
						</Choice>
					))}
				</Group>
				<Group label="装饰">
					{(["pattern", "light"] as DecoVariant[]).map((key) => (
						<Choice key={key} value={key} current={deco} onSelect={setDeco}>
							{{ pattern: "纹样", light: "天光" }[key]}
						</Choice>
					))}
				</Group>
				<Link
					to="/prototype/seasons"
					className="flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs text-background/70 hover:text-background"
				>
					<LayoutGrid className="size-3.5" />
					并排对照
				</Link>
			</div>
		</div>
	);
}

export function PrototypeShell() {
	useUrlSync();
	if (!import.meta.env.DEV) return null;
	return (
		<>
			<GlobalTheme />
			<PrototypeBar />
		</>
	);
}
