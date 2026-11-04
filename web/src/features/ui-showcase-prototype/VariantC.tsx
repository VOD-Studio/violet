import { useState } from "react";
import { InspectorBody } from "./Inspector";
import { type Exhibit, ZONES } from "./exhibits";
import { FitBadge, ProtoRoot, Stage, StatusChip, Toolbar, type VariantProps, useFit } from "./shared";

/**
 * PROTOTYPE 变体 C「橱窗长廊」
 * 结构：每个展区是一条横向货架，展品保持真实尺寸站在搁板上，放不下就横向滑动；
 * 铭牌挂在搁板下方，点开在这条货架正下方就地展开检视台，不离开长廊。
 */
function Standing({ e, s, set, active }: { e: Exhibit; active: boolean } & Pick<VariantProps, "s" | "set">) {
	const [play, setPlay] = useState(false);
	return (
		<div
			className="flex shrink-0 flex-col px-5"
			onPointerEnter={() => setPlay(true)}
			onPointerLeave={() => setPlay(false)}
		>
			<div
				role="button"
				tabIndex={0}
				onClick={() => set({ open: active ? null : e.id })}
				onKeyDown={(ev) => ev.key === "Enter" && set({ open: active ? null : e.id })}
				className={`cursor-pointer rounded-t-2xl bg-(--sheet) p-4 pb-5 shadow-[0_4px_24px_rgb(0_0_0/0.05)] ${active ? "outline outline-2 outline-(--deco)" : ""}`}
			>
				<Stage e={e} play={play} state={e.states[0] ?? "默认"} outline={s.outline} />
			</div>
			<div className="-mx-5 h-2.5 bg-(--sunk) shadow-[0_6px_10px_-6px_rgb(0_0_0/0.25)]" />
			<div className="mt-2 flex items-baseline gap-2" style={{ maxWidth: e.w + 32 }}>
				<b className="text-[13px] font-semibold whitespace-nowrap">{e.name}</b>
				<span className="truncate font-mono text-[10px] text-(--muted)">{e.slug}</span>
				<StatusChip e={e} />
			</div>
		</div>
	);
}

export function VariantC({ s: routeState, set: routeSet, exhibits }: VariantProps) {
	const [openId, setOpenId] = useState<string | null>(routeState.open);
	const s = { ...routeState, open: openId };
	const set: VariantProps["set"] = (patch) => {
		if ("open" in patch) setOpenId(patch.open ?? null);
		routeSet(patch);
	};
	return (
		<ProtoRoot s={s}>
			<div className="pt-10 pb-28">
				<header className="mx-auto mb-10 max-w-[1240px] px-5 sm:px-10">
					<h1 className="text-[44px] leading-[1.1] font-normal sm:text-[52px]">橱窗长廊</h1>
					<p className="mt-3 max-w-[620px] text-[13px] leading-[1.8] text-(--muted)">
						展品按真实尺寸站在搁板上，一条货架一个展区；放不下就沿搁板横向滑动。点一件，检视台在这条货架下方展开。
					</p>
					<div className="mt-6">
						<Toolbar s={s} set={set} count={exhibits.length} />
					</div>
				</header>
				{ZONES.map((z) => {
					const list = exhibits.filter((e) => e.zone === z.id);
					if (list.length === 0) return null;
					return <Shelf key={z.id} zone={z} list={list} s={s} set={set} />;
				})}
			</div>
		</ProtoRoot>
	);
}

function Shelf({
	zone,
	list,
	s,
	set,
}: { zone: (typeof ZONES)[number]; list: Exhibit[] } & Pick<VariantProps, "s" | "set">) {
	const [ref, fit] = useFit<HTMLDivElement>();
	const open = list.find((e) => e.id === s.open);
	return (
		<section className="mb-14">
			<div className="mx-auto mb-3 flex max-w-[1240px] items-baseline gap-3 px-5 sm:px-10">
				<h2 className="text-[22px] font-semibold">{zone.name}</h2>
				<span className="font-mono text-xs text-(--muted)">{list.length}</span>
				<span className="text-[13px] text-(--muted)">{zone.rule}</span>
				<span className="ml-auto">
					<FitBadge fit={fit} />
				</span>
			</div>
			<div
				ref={ref}
				className="proto-scroll overflow-x-auto overflow-y-hidden"
				style={{ scrollSnapType: "x proximity" }}
			>
				<div className="mx-auto flex w-max min-w-full items-end justify-center-safe px-5 sm:px-10">
					{list.map((e) => (
						<Standing key={e.id} e={e} s={s} set={set} active={s.open === e.id} />
					))}
				</div>
			</div>
			{open && (
				<div className="mx-auto mt-6 max-w-[1240px] px-5 sm:px-10">
					<div className="rounded-2xl border border-(--rule) bg-(--bg) p-5">
						<InspectorBody key={open.id} e={open} outline={s.outline} />
					</div>
				</div>
			)}
		</section>
	);
}
