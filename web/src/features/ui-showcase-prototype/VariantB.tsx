import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useState } from "react";
import { InspectorBody } from "./Inspector";
import { type Exhibit, ZONES } from "./exhibits";
import { FitBadge, ProtoRoot, Stage, StatusChip, Toolbar, type VariantProps, useFit } from "./shared";

/**
 * PROTOTYPE 变体 B「陈列室」
 * 结构：每个展区是一间展厅，两栏陈列，整幅展品通栏；同一行的展柜底座落在同一条地面线上。
 * 质感：藏品感——柜内有聚光，柜下有台座和编号铭牌；点开是「走近」全屏观看。
 */
function Vitrine({ e, no, total, s, set }: { e: Exhibit; no: number; total: number } & Pick<VariantProps, "s" | "set">) {
	const [play, setPlay] = useState(false);
	const [ref, fit] = useFit<HTMLDivElement>();
	const wide = e.zone === "banner";
	return (
		<figure className={`m-0 flex min-w-0 flex-col justify-end ${wide ? "col-span-full" : ""}`}>
			<div
				role="button"
				tabIndex={0}
				onClick={() => set({ open: e.id })}
				onKeyDown={(ev) => ev.key === "Enter" && set({ open: e.id })}
				onPointerEnter={() => setPlay(true)}
				onPointerLeave={() => setPlay(false)}
				className="cursor-zoom-in"
			>
				<div
					ref={ref}
					className="proto-scroll flex overflow-auto rounded-t-[22px] p-8 outline outline-1 -outline-offset-1 outline-(--rule2)"
					style={{
						minHeight: e.h + 64,
						background:
							"radial-gradient(75% 85% at 50% 0%, color-mix(in oklab, var(--deco) 20%, var(--sheet)) 0%, var(--sheet) 62%, var(--sunk) 100%)",
					}}
				>
					<div className="mx-auto self-center">
						<Stage e={e} play={play} state={e.states[0] ?? "默认"} outline={s.outline} />
					</div>
				</div>
				<div className="flex h-11 items-center justify-between rounded-b-md bg-[color-mix(in_oklab,var(--fg)_92%,var(--bg))] px-5 text-(--sheet)">
					<span className="font-mono text-[11px] tracking-widest opacity-70">
						№ {String(no).padStart(2, "0")} / {String(total).padStart(2, "0")}
					</span>
					<span className="flex items-baseline gap-2">
						<b className="text-sm font-semibold">{e.name}</b>
						<span className="font-mono text-[11px] opacity-70">{e.slug}</span>
					</span>
					<span className="flex items-center gap-3">
						<StatusChip e={e} />
						<span className="rounded-full bg-(--sheet) px-2">
							<FitBadge fit={fit} />
						</span>
					</span>
				</div>
			</div>
		</figure>
	);
}

export function VariantB({ s, set, exhibits }: VariantProps) {
	const idx = exhibits.findIndex((e) => e.id === s.open);
	const open = exhibits[idx];
	useEffect(() => {
		if (!open) return;
		const onKey = (ev: KeyboardEvent) => {
			if (ev.key === "Escape") set({ open: null });
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, set]);
	let n = 0;
	return (
		<ProtoRoot s={s} paper={false}>
			<div className="mx-auto w-full max-w-[3200px] px-5 pt-12 pb-32 sm:px-10">
				<header className="mb-14 border-b border-(--rule2) pb-8">
					<p className="font-mono text-[11px] tracking-[0.3em] text-(--muted) uppercase">Violet UED · 馆藏目录</p>
					<h1 className="mt-3 text-[44px] leading-[1.1] font-normal sm:text-[60px]">组件陈列室</h1>
					<p className="mt-4 max-w-[600px] text-[13px] leading-[1.8] text-(--muted)">
						共 {exhibits.length} 件展品，按占地分到五间展厅。每件有编号和铭牌，走近可以切换状态、查看占地。
					</p>
					<div className="mt-6">
						<Toolbar s={s} set={set} count={exhibits.length} />
					</div>
				</header>
				{ZONES.map((z, zi) => {
					const list = exhibits.filter((e) => e.zone === z.id);
					if (list.length === 0) return null;
					return (
						<section key={z.id} className="mb-20">
							<div className="mb-8 flex flex-wrap items-end justify-between gap-2 border-b border-(--rule) pb-3">
								<h2 className="text-[30px] leading-tight font-normal">
									<span className="mr-3 font-mono text-sm text-(--muted)">第 {zi + 1} 展厅</span>
									{z.name}
								</h2>
								<p className="text-[13px] text-(--muted)">{z.rule}</p>
							</div>
							<div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,624px),1fr))] items-end gap-x-10 gap-y-12">
								{list.map((e) => {
									n += 1;
									return <Vitrine key={e.id} e={e} no={n} total={exhibits.length} s={s} set={set} />;
								})}
							</div>
						</section>
					);
				})}
			</div>
			{open && (
				<div
					className="fixed inset-0 z-[9990] overflow-auto bg-[color-mix(in_oklab,var(--bg)_90%,transparent)] p-6 backdrop-blur-[20px] sm:p-10"
					role="dialog"
					aria-label={`走近 ${open.name}`}
				>
					<div className="mx-auto flex max-w-[1240px] items-center justify-between pb-4">
						<span className="font-mono text-xs text-(--muted)">
							走近 · № {String(idx + 1).padStart(2, "0")} / {String(exhibits.length).padStart(2, "0")}
						</span>
						<div className="flex items-center gap-2">
							<button type="button" aria-label="上一件" className="flex size-9 items-center justify-center rounded-full bg-(--sunk)" onClick={() => set({ open: exhibits[(idx - 1 + exhibits.length) % exhibits.length].id })}>
								<ChevronLeft className="size-4" />
							</button>
							<button type="button" aria-label="下一件" className="flex size-9 items-center justify-center rounded-full bg-(--sunk)" onClick={() => set({ open: exhibits[(idx + 1) % exhibits.length].id })}>
								<ChevronRight className="size-4" />
							</button>
							<button type="button" aria-label="离开" className="flex size-9 items-center justify-center rounded-full bg-(--sunk)" onClick={() => set({ open: null })}>
								<X className="size-4" />
							</button>
						</div>
					</div>
					<div className="mx-auto max-w-[1240px]">
						<InspectorBody key={open.id} e={open} outline={s.outline} />
					</div>
				</div>
			)}
		</ProtoRoot>
	);
}
