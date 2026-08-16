import { FloatingBackButton } from "@features/lab/nav/ui/FloatingBackButton";
import { ProgressBackRail } from "@features/lab/nav/ui/ProgressBackRail";
import { ScrollRevealChip } from "@features/lab/nav/ui/ScrollRevealChip";
import { StickyBackBar } from "@features/lab/nav/ui/StickyBackBar";
import { LabHeader } from "@features/lab/ui/LabHeader";
import { Segmented } from "@shared/ui/segmented";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

type NavDirection = "sticky" | "fab" | "reveal" | "progress";

const DIRECTIONS: { value: NavDirection; label: string; intent: string }[] = [
	{
		value: "sticky",
		label: "吸顶返回条",
		intent: "原标题滚出后，细条吸附滚动区顶部：返回 + 来源页 + 截断标题常驻可读。信息最全，最贴新闻站与文档站。",
	},
	{
		value: "fab",
		label: "浮动返回钮",
		intent: "滚过一屏后左下浮出圆钮，回到顶部自动隐去。chrome 最少；生产可并入文章页右下已有的浮动操作区（目录 / 返回顶部同列）。",
	},
	{
		value: "reveal",
		label: "上滑显现",
		intent: "向下读时隐身，向上滑时底部浮出返回胶囊，手势即意图。最不打扰，但可发现性靠运气，宜作补充入口。",
	},
	{
		value: "progress",
		label: "进度线返回",
		intent: "复用文章页已有的顶部阅读进度线，滚过一屏后线上浮出返回箭头。进度与退路同框，不新增 chrome 语言。",
	},
];

/**
 * /lab/nav - 返回导航实验室
 *
 * 问题：返回入口只存在于页头，滚动到中段后完全离场。常态入口已
 * 统一为页头返回胶囊（BackLink，LabHeader 内置，lab 页头与文章页头
 * 页头那颗）；滚动离场后的接管策略由四个候选方向对比，覆盖四种
 * 位置哲学：顶（吸顶）/ 侧（浮钮）/ 底（上滑显现）/ 线（进度）。
 * 选定方向后落到文章详情页。
 */
function NavLab() {
	const [direction, setDirection] = useState<NavDirection>("sticky");
	const active = DIRECTIONS.find((d) => d.value === direction) ?? DIRECTIONS[0];

	return (
		<div className="container mx-auto px-6 py-24">
			<LabHeader to="/lab/nav" />

			<section>
				<div className="mb-6 flex flex-wrap items-center justify-between gap-4">
					<Segmented
						value={direction}
						onValueChange={setDirection}
						segments={DIRECTIONS.map((d) => ({ value: d.value, label: d.label }))}
					/>
				</div>

				<p className="mb-6 font-mono text-xs text-muted-foreground">
					<span className="mr-2 tracking-[0.3em] text-muted-foreground/60 uppercase">
						Intent
					</span>
					{active.intent}
				</p>

				<div className="rounded-2xl border border-edge-hairline bg-background/40 p-6 md:p-10">
					<p className="mb-8 font-mono text-[10px] tracking-[0.3em] text-muted-foreground/50 uppercase">
						Preview · violet.blog · {active.label} · 演示区可滚动
					</p>
					<div key={direction}>
						{direction === "sticky" ? <StickyBackBar /> : null}
						{direction === "fab" ? <FloatingBackButton /> : null}
						{direction === "reveal" ? <ScrollRevealChip /> : null}
						{direction === "progress" ? <ProgressBackRail /> : null}
					</div>
				</div>
			</section>
		</div>
	);
}

export const Route = createFileRoute("/lab/nav")({
	component: NavLab,
});
