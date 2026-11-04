import { X } from "lucide-react";
import { useState } from "react";
import { InspectorBody } from "./Inspector";
import { type Exhibit, ZONES } from "./exhibits";
import { FitBadge, ProtoRoot, Stage, StatusChip, Toolbar, type VariantProps, useFit } from "./shared";

/**
 * PROTOTYPE 变体 A「纸面展区」
 * 结构：按占地分区，展柜用 flex-wrap 按自身占地宽度自然成行，不预设列数。
 * 质感：克制纸面，展柜是纸片，铭牌在柜外下方，检视台是右侧抽屉。
 */
function CaseA({ e, s, set }: { e: Exhibit } & Pick<VariantProps, "s" | "set">) {
	const [play, setPlay] = useState(false);
	const [ref, fit] = useFit<HTMLDivElement>();
	return (
		<figure className="m-0 flex min-w-0 flex-col gap-2" style={{ flex: `1 1 ${e.w + 42}px`, maxWidth: "100%" }}>
			<div
				role="button"
				tabIndex={0}
				onClick={() => set({ open: e.id })}
				onKeyDown={(ev) => ev.key === "Enter" && set({ open: e.id })}
				onPointerEnter={() => setPlay(true)}
				onPointerLeave={() => setPlay(false)}
				onFocus={() => setPlay(true)}
				onBlur={() => setPlay(false)}
				className="cursor-pointer rounded-2xl"
			>
				<div
					ref={ref}
					className="proto-scroll flex overflow-auto rounded-2xl border border-(--ol) bg-(--sheet) p-[20px] shadow-[0_4px_24px_rgb(0_0_0/0.05)]"
					style={{ minHeight: e.h + 40 }}
				>
					<div className="mx-auto">
						<Stage e={e} play={play} state={e.states[0] ?? "默认"} outline={s.outline} />
					</div>
				</div>
			</div>
			<figcaption className="flex items-baseline gap-2 px-1">
				<b className="text-sm font-semibold">{e.name}</b>
				<span className="font-mono text-[11px] text-(--muted)">{e.slug}</span>
				<StatusChip e={e} />
				<span className="ml-auto">
					<FitBadge fit={fit} />
				</span>
			</figcaption>
		</figure>
	);
}

export function VariantA({ s, set, exhibits }: VariantProps) {
	const open = exhibits.find((e) => e.id === s.open);
	return (
		<ProtoRoot s={s}>
			<div className="mx-auto w-full max-w-[1260px] px-5 pt-10 pb-28 sm:px-10">
				<header className="mb-10">
					<h1 className="text-[44px] leading-[1.1] font-normal sm:text-[52px]">组件</h1>
					<p className="mt-3 max-w-[640px] text-[13px] leading-[1.8] text-(--muted)">
						按占地分区陈列：每件展品声明自己需要的舞台空间，展柜跟着长，放不下的横向滑动而不是被裁掉。指针移上去会动，点开进入检视台。
					</p>
					<div className="mt-6">
						<Toolbar s={s} set={set} count={exhibits.length} />
					</div>
				</header>
				{ZONES.map((z) => {
					const list = exhibits.filter((e) => e.zone === z.id);
					if (list.length === 0) return null;
					return (
						<section key={z.id} className="mb-12">
							<div className="mb-4 flex items-baseline gap-3">
								<h2 className="text-[22px] font-semibold">{z.name}</h2>
								<span className="font-mono text-xs text-(--muted)">{list.length}</span>
								<span className="text-[13px] text-(--muted)">{z.rule}</span>
							</div>
							<div className="flex flex-wrap gap-4">
								{list.map((e) => (
									<CaseA key={e.id} e={e} s={s} set={set} />
								))}
							</div>
						</section>
					);
				})}
			</div>
			{open && (
				<>
					<button
						type="button"
						aria-label="关闭检视台"
						className="fixed inset-0 z-[9990] cursor-default bg-[rgb(20_16_14/.32)]"
						onClick={() => set({ open: null })}
					/>
					<aside className="fixed top-0 right-0 bottom-0 z-[9991] w-full max-w-[640px] overflow-auto bg-(--bg) p-6 shadow-[0_4px_24px_rgb(0_0_0/0.05)]">
						<button
							type="button"
							aria-label="关闭"
							onClick={() => set({ open: null })}
							className="mb-3 flex size-9 items-center justify-center rounded-full bg-(--sunk)"
						>
							<X className="size-4" />
						</button>
						<InspectorBody key={open.id} e={open} outline={s.outline} />
					</aside>
				</>
			)}
		</ProtoRoot>
	);
}
