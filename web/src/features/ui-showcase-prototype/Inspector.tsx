import { useState } from "react";
import type { Exhibit } from "./exhibits";
import { ZONES } from "./exhibits";
import { FitBadge, StatusChip, Stage, useFit } from "./shared";

/**
 * PROTOTYPE — 可丢弃。检视台内容：状态切换、占地信息、裁切检查。
 * 外壳（抽屉、全屏、行内）由各变体自己包。
 */
export function InspectorBody({ e, outline }: { e: Exhibit; outline: boolean }) {
	const [state, setState] = useState(e.states[0] ?? "默认");
	const [showOutline, setShowOutline] = useState(outline);
	const [ref, fit] = useFit<HTMLDivElement>();
	const zone = ZONES.find((z) => z.id === e.zone);
	return (
		<div className="flex min-w-0 flex-col gap-4">
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
				<h3 className="text-[22px] font-semibold">{e.name}</h3>
				<span className="font-mono text-xs text-(--muted)">{e.slug}</span>
				<StatusChip e={e} />
			</div>
			<div className="flex flex-wrap items-center gap-2 text-[13px]">
				{e.states.length === 0 && <span className="text-(--muted)">只有默认态</span>}
				{e.states.map((st) => (
					<button
						key={st}
						type="button"
						onClick={() => setState(st)}
						className={`h-8 rounded-full px-3 ${state === st ? "bg-(--fg) text-(--sheet)" : "bg-(--sunk) text-(--muted)"}`}
					>
						{st}
					</button>
				))}
				<button
					type="button"
					onClick={() => setShowOutline((v) => !v)}
					className={`h-8 rounded-full px-3 ${showOutline ? "bg-(--fg) text-(--sheet)" : "bg-(--sunk) text-(--muted)"}`}
				>
					占地框
				</button>
			</div>
			<div
				ref={ref}
				className="proto-scroll overflow-auto rounded-2xl bg-(--sheet) p-5 shadow-[0_4px_24px_rgb(0_0_0/0.05)]"
				style={{ maxHeight: "60vh" }}
			>
				<div className="mx-auto w-fit">
					<Stage e={e} play state={state} outline={showOutline} />
				</div>
			</div>
			<dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-[13px]">
				<dt className="text-(--muted)">展区</dt>
				<dd>{zone?.name}</dd>
				<dt className="text-(--muted)">占地</dt>
				<dd className="font-mono">
					{e.w} × {e.h}（含展开态）
				</dd>
				<dt className="text-(--muted)">裁切检查</dt>
				<dd>
					<FitBadge fit={fit} />
				</dd>
			</dl>
		</div>
	);
}
