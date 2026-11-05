import { FlowerBloom, type FlowerKind, Spinner } from "@violet/ui";
import { useEffect, useState } from "react";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

const FLOWER_KINDS: [FlowerKind, string][] = [
	["plum", "梅花"],
	["sakura", "樱花"],
	["lotus", "荷花"],
	["osmanthus", "桂花"],
	["snow", "雪花"],
	["branch", "梅枝"],
];

const SIZES = [16, 20, 24, 32, 48] as const;

/** 控件内加载演示：aria-busy 立即生效，指示器按 200ms/400ms 规律显示。 */
function BusyDemo() {
	const [busy, setBusy] = useState(true);
	useEffect(() => {
		const timer = window.setInterval(() => setBusy((v) => !v), 2600);
		return () => window.clearInterval(timer);
	}, []);
	return (
		<span
			role="status"
			aria-live="polite"
			aria-busy={busy}
			className="bg-muted text-foreground inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm"
		>
			{busy ? (
				<Spinner aria-hidden="true" />
			) : (
				<span className="text-muted-foreground inline-block size-4" aria-hidden="true" />
			)}
			<span>{busy ? "正在加载评论" : "已完成"}</span>
		</span>
	);
}

function IndicatorFamily({ state }: ExhibitRenderProps) {
	if (state === "control") {
		return (
			<div className="flex flex-col items-start gap-4">
				<BusyDemo />
				<div className="text-muted-foreground flex items-center gap-3 text-sm">
					<Spinner aria-hidden="true" className="text-decoration" />
					<Spinner aria-hidden="true" />
					<Spinner aria-hidden="true" size={20} />
					<Spinner aria-hidden="true" size={24} className="text-link" />
					<span className="text-xs">
						200ms 延迟显示 · 400ms 最短停留 · aria-busy 立即生效
					</span>
				</div>
			</div>
		);
	}
	const kinds: FlowerKind[] =
		state === "season"
			? ["sakura", "lotus", "osmanthus", "plum"]
			: FLOWER_KINDS.map(([k]) => k);
	return (
		<div className="flex flex-col items-start gap-5">
			{state === "sizes" ? (
				<div className="flex flex-wrap items-end gap-6">
					{SIZES.map((size) => (
						<span key={size} className="flex items-end gap-3">
							<FlowerBloom kind="sakura" size={size} aria-hidden="true" />
							<span className="text-muted-foreground font-mono text-xs">{size}</span>
						</span>
					))}
				</div>
			) : (
				<div className="flex flex-wrap items-center gap-6">
					{kinds.map((k) => (
						<FlowerBloom
							key={k}
							kind={k}
							size={state === "season" ? 32 : 24}
							aria-hidden="true"
						/>
					))}
				</div>
			)}
			{state === "season" && (
				<span className="text-muted-foreground text-xs">
					春樱 · 夏荷 · 秋桂 · 冬梅，跟随季节切换
				</span>
			)}
		</div>
	);
}

export const indicatorExhibit: Exhibit = {
	id: "indicator",
	name: "指示器",
	units: ["indicator"],
	zone: "shelf",
	category: "feedback",
	footprint: { width: 460, height: 132 },
	states: [
		{ id: "default", label: "六款花形" },
		{ id: "season", label: "当季花形" },
		{ id: "sizes", label: "五档尺寸" },
		{ id: "control", label: "控件圆弧" },
	],
	Render: IndicatorFamily,
};
