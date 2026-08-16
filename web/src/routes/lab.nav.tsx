import { EndingBackBlock } from "@features/lab/nav/ui/EndingBackBlock";
import { FloatingBackButton } from "@features/lab/nav/ui/FloatingBackButton";
import { ScrollRevealChip } from "@features/lab/nav/ui/ScrollRevealChip";
import { StickyBackBar } from "@features/lab/nav/ui/StickyBackBar";
import { Segmented } from "@shared/ui/segmented";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";

type NavDirection = "sticky" | "fab" | "reveal" | "ending";

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
		value: "ending",
		label: "文末返回块",
		intent: "不做常驻 chrome：文章读完处放大返回入口，配回到顶部次操作。离场点明确、零干扰，但中途离开仍无解。",
	},
];

/**
 * /lab/nav - 返回导航实验室
 *
 * 问题：返回入口只存在于页头（「← Labs」「← 博客」），滚动到中段后
 * 完全离场。四个候选方向在同一个可滚动演示长文里对比，覆盖四种
 * 位置哲学：顶（吸顶）/ 侧（浮钮）/ 底（上滑显现）/ 文末（离场点）。
 * 选定方向后落到 lab 页头与文章详情页。
 */
function NavLab() {
	const [direction, setDirection] = useState<NavDirection>("sticky");
	const active = DIRECTIONS.find((d) => d.value === direction) ?? DIRECTIONS[0];

	return (
		<div className="container mx-auto px-6 py-24">
			<div className="mb-16 text-center">
				<Link
					to="/lab"
					className="mb-6 inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.25em] text-muted-foreground uppercase transition-colors hover:text-foreground"
				>
					<ArrowLeft className="size-3.5" />
					Labs
				</Link>
				<h1 className="mb-4 text-4xl font-bold tracking-tight">返回导航实验室</h1>
				<p className="mx-auto max-w-xl text-muted-foreground">
					长页面滚动后仍可达的四种返回方案。
				</p>
			</div>

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
						{direction === "ending" ? <EndingBackBlock /> : null}
					</div>
				</div>
			</section>
		</div>
	);
}

export const Route = createFileRoute("/lab/nav")({
	component: NavLab,
});
