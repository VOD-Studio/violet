import { ChevronLeft, ChevronRight } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { CATEGORIES, type Category, type Exhibit, STATUS_LABEL } from "./exhibits";
import { type Mode, SEASONS, type Season, seasonVars } from "./tokens";

/**
 * PROTOTYPE — 可丢弃。三个变体共用的最小部件：根容器、工具栏、占地框、
 * 裁切检查、切换栏。布局不共用。
 */
export interface ProtoState {
	season: Season;
	mode: Mode;
	outline: boolean;
	reduced: boolean;
	cat: Category | "全部";
	open: string | null;
}

export interface VariantProps {
	s: ProtoState;
	set: (patch: Partial<ProtoState>) => void;
	exhibits: Exhibit[];
}

const CSS = `
@keyframes proto-spin { to { transform: rotate(360deg); } }
.proto-arc { animation: proto-spin .8s linear infinite; }
@keyframes proto-morph {
  from { width: 190px; height: 44px; border-radius: 22px; }
  to { width: 360px; height: 300px; border-radius: 16px; }
}
@keyframes proto-morph-body { from { opacity: 0; } 55% { opacity: 0; } to { opacity: 1; } }
.proto-morph[data-play="1"] { animation: proto-morph 2.4s cubic-bezier(.22,1,.36,1) infinite alternate; }
.proto-morph[data-play="1"] .proto-morph-body { animation: proto-morph-body 2.4s linear infinite alternate; }
[data-motion="reduced"] *, [data-motion="reduced"] *::before, [data-motion="reduced"] *::after {
  animation: none !important; transition: none !important;
}
.proto-scroll { scrollbar-width: thin; }
`;

export function ProtoRoot({
	s,
	children,
	paper = true,
}: {
	s: ProtoState;
	children: ReactNode;
	paper?: boolean;
}) {
	return (
		<div
			data-motion={s.reduced ? "reduced" : "normal"}
			className="fixed inset-0 z-[9999] overflow-auto text-sm"
			style={{
				...seasonVars(s.season, s.mode),
				background: "var(--bg)",
				color: "var(--fg)",
				fontFamily: '"Songti SC","Noto Serif SC","Source Han Serif SC",STSong,SimSun,serif',
				lineHeight: 1.6,
				colorScheme: s.mode,
			}}
		>
			<style>{CSS}</style>
			{paper && (
				<div
					aria-hidden
					className="pointer-events-none absolute inset-x-0 top-0 min-h-full"
					style={{
						backgroundImage: `url(/prototype/${s.mode === "dark" ? "paper-d" : "paper-l"}.webp)`,
						backgroundSize: "1440px 1600px",
						backgroundRepeat: "repeat-y",
						backgroundPosition: "top center",
					}}
				/>
			)}
			<div className="relative">{children}</div>
		</div>
	);
}

function Chip({
	on,
	onClick,
	children,
}: {
	on: boolean;
	onClick: () => void;
	children: ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`h-8 rounded-full px-3 text-[13px] whitespace-nowrap ${on ? "bg-(--fg) text-(--sheet)" : "bg-(--sunk) text-(--muted)"}`}
		>
			{children}
		</button>
	);
}

export function Toolbar({ s, set, count }: Omit<VariantProps, "exhibits"> & { count: number }) {
	return (
		<div className="flex flex-wrap items-center gap-x-6 gap-y-2">
			<div className="flex items-center gap-1.5">
				{(Object.keys(SEASONS) as Season[]).map((k) => (
					<Chip key={k} on={s.season === k} onClick={() => set({ season: k })}>
						{SEASONS[k].name}
					</Chip>
				))}
			</div>
			<div className="flex items-center gap-1.5">
				<Chip on={s.mode === "light"} onClick={() => set({ mode: "light" })}>
					浅色
				</Chip>
				<Chip on={s.mode === "dark"} onClick={() => set({ mode: "dark" })}>
					深色
				</Chip>
			</div>
			<div className="flex items-center gap-1.5">
				<Chip on={s.outline} onClick={() => set({ outline: !s.outline })}>
					占地框
				</Chip>
				<Chip on={s.reduced} onClick={() => set({ reduced: !s.reduced })}>
					减弱动态
				</Chip>
			</div>
			<div className="flex flex-wrap items-center gap-1.5">
				{(["全部", ...CATEGORIES] as const).map((c) => (
					<Chip key={c} on={s.cat === c} onClick={() => set({ cat: c })}>
						{c}
					</Chip>
				))}
			</div>
			<span className="font-mono text-xs text-(--muted)">{count} 件展品</span>
		</div>
	);
}

export type Fit = "ok" | "scroll" | "clip";

/** 裁切检查：展柜内容框的可滚动溢出。横向溢出 = 需要滚动，纵向溢出 = 占地声明有误。 */
export function useFit<T extends HTMLElement>() {
	const ref = useRef<T>(null);
	const [fit, setFit] = useState<Fit>("ok");
	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const measure = () => {
			const h = el.scrollWidth > el.clientWidth + 1;
			const v = el.scrollHeight > el.clientHeight + 1;
			setFit(v ? "clip" : h ? "scroll" : "ok");
		};
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		for (const c of Array.from(el.children)) ro.observe(c);
		return () => ro.disconnect();
	}, []);
	return [ref, fit] as const;
}

export function FitBadge({ fit }: { fit: Fit }) {
	const map = {
		ok: ["✓ 完整", "var(--ok)"],
		scroll: ["↔ 需横向滚动", "var(--accent)"],
		clip: ["⚠ 溢出", "var(--danger)"],
	} as const;
	const [text, color] = map[fit];
	return (
		<span className="font-mono text-[11px] whitespace-nowrap" style={{ color }}>
			{text}
		</span>
	);
}

/** 展品舞台：固定占地尺寸，可叠加占地框。 */
export function Stage({
	e,
	play,
	state,
	outline,
}: {
	e: Exhibit;
	play: boolean;
	state: string;
	outline: boolean;
}) {
	return (
		<div className="relative shrink-0" style={{ width: e.w, height: e.h }}>
			<e.Render state={state} play={play} />
			{outline && (
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 border border-dashed"
					style={{ borderColor: "var(--deco)" }}
				>
					<span className="absolute top-0 right-0 bg-(--deco) px-1 font-mono text-[10px] text-white">
						{e.w}×{e.h}
					</span>
				</div>
			)}
		</div>
	);
}

export function StatusChip({ e }: { e: Exhibit }) {
	return (
		<span className="rounded-full bg-(--sunk) px-2 py-px font-mono text-[10px] text-(--muted)">
			{STATUS_LABEL[e.status]}
		</span>
	);
}

export function Switcher({
	variants,
	current,
	onChange,
}: {
	variants: { key: string; name: string }[];
	current: string;
	onChange: (k: string) => void;
}) {
	const idx = Math.max(
		0,
		variants.findIndex((v) => v.key === current),
	);
	const go = (d: number) => onChange(variants[(idx + d + variants.length) % variants.length].key);
	useEffect(() => {
		const onKey = (ev: KeyboardEvent) => {
			const t = ev.target as HTMLElement | null;
			if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
			if (ev.key === "ArrowLeft") go(-1);
			if (ev.key === "ArrowRight") go(1);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});
	if (import.meta.env.PROD) return null;
	return (
		<div className="fixed bottom-4 left-1/2 z-[10000] flex -translate-x-1/2 items-center gap-1 rounded-full bg-neutral-900 px-2 py-1.5 font-sans text-xs text-white shadow-lg">
			<button type="button" aria-label="上一个变体" onClick={() => go(-1)} className="rounded-full p-1.5 hover:bg-white/15">
				<ChevronLeft className="size-4" />
			</button>
			<span className="min-w-44 px-2 text-center font-mono">
				{variants[idx].key} — {variants[idx].name}
			</span>
			<button type="button" aria-label="下一个变体" onClick={() => go(1)} className="rounded-full p-1.5 hover:bg-white/15">
				<ChevronRight className="size-4" />
			</button>
		</div>
	);
}
