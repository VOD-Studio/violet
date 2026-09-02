import { ALL_SECTION_IDS, TOC_TREE, type TocVariant } from "@features/lab/toc/model/article";
import { useActiveSection } from "@features/lab/toc/model/use-active-section";
import { DemoArticle } from "@features/lab/toc/ui/DemoArticle";
import { TocVariantView } from "@features/lab/toc/ui/TocVariants";
import { LabHeader } from "@features/lab/ui/LabHeader";
import { cn } from "@shared/lib/utils";
import { Segmented } from "@shared/ui/segmented";
import { createFileRoute } from "@tanstack/react-router";
import { PanelLeft, PanelLeftClose } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

const VARIANTS: { value: TocVariant; label: string; intent: string }[] = [
	{
		value: "liquid",
		label: "Liquid Rail",
		intent: "流体微光轨道：展开时为高精度标尺与平滑光斑药丸；收起时每根微线与展开标题 1:1 原位几何对齐，高度绝对等高。",
	},
	{
		value: "monograph",
		label: "Monograph Index",
		intent: "典藏刊物索表：源自实体刊物排版美学，展开带点状引线与小节符号；收起时化为全量 11 项等宽微章印珠链，高度绝对等高。",
	},
	{
		value: "kinetic",
		label: "Kinetic Branch",
		intent: "贝塞尔生长树：展开为优雅的贝塞尔曲线节点树；收起时聚合成单轨微光纤维晶体，当前节点光环扩散，高度严格等高。",
	},
	{
		value: "capsule",
		label: "Segmented Pillars",
		intent: "晶体段落手风琴：展开为透光半透明卡片手风琴；收起时退化为垂直胶囊堆叠段，内部子要点微格全量可交互，高度严格等高。",
	},
	{
		value: "minimap",
		label: "Spatial Minimap",
		intent: "空间全景微地图：展开为大纲+微缩雷达双栏联动；收起时为超窄极简雷达光带，视口透镜实时精准追踪，高度严格等高。",
	},
];

function TocTreeLab() {
	const [variant, setVariant] = useState<TocVariant>("liquid");
	const [isCompact, setIsCompact] = useState(false);
	const [collapsedIds, setCollapsedIds] = useState(() => new Set<string>());
	const reducedMotion = useReducedMotion();
	const { activeId, navigate } = useActiveSection();
	const asideRef = useRef<HTMLElement>(null);
	const [expandedHeight, setExpandedHeight] = useState<number | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: 切换方案或折叠状态时需重新捕获当前方案的自然展开高度
	useLayoutEffect(() => {
		if (!isCompact && asideRef.current) {
			const rect = asideRef.current.getBoundingClientRect();
			if (rect.height > 0) {
				setExpandedHeight(Math.round(rect.height));
			}
		}
	}, [isCompact, variant, collapsedIds]);

	const onNavigate = useCallback(
		(id: string) => navigate(id, reducedMotion === true),
		[navigate, reducedMotion],
	);

	const onToggle = useCallback((id: string) => {
		setCollapsedIds((current) => {
			const next = new Set(current);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}, []);

	const currentActiveIdx = ALL_SECTION_IDS.indexOf(activeId);
	const activeNumStr = String(currentActiveIdx >= 0 ? currentActiveIdx + 1 : 1).padStart(2, "0");

	return (
		<div className="container mx-auto px-4 py-4 sm:px-6">
			<LabHeader to="/lab/toc-tree" />

			{/* 顶部控制栏：方案选择 Tab + 展开/收起切换 */}
			<div className="sticky top-2 z-40 mb-6 flex flex-wrap items-center justify-between gap-3 overflow-x-auto rounded-xl border border-edge-hairline bg-background/90 p-1.5 shadow-xs backdrop-blur-md md:top-4">
				<Segmented
					value={variant}
					onValueChange={setVariant}
					segments={VARIANTS.map((v) => ({ value: v.value, label: v.label }))}
					className="min-w-max"
				/>

				{/* 展开/窄轨收起模式切换按钮 */}
				<button
					type="button"
					onClick={() => setIsCompact((v) => !v)}
					className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-edge-hairline bg-muted/40 px-2.5 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
				>
					{isCompact ? (
						<PanelLeft className="size-3.5" />
					) : (
						<PanelLeftClose className="size-3.5" />
					)}
					<span className="text-[11px]">{isCompact ? "展开目录" : "收起为窄轨"}</span>
				</button>
			</div>

			{/* 方案设计理念说明 */}
			<p className="mb-8 font-mono text-xs text-muted-foreground">
				<span className="mr-2 tracking-[0.3em] text-muted-foreground/60 uppercase">
					Intent
				</span>
				{VARIANTS.find((v) => v.value === variant)?.intent}
			</p>

			{/* 主展示区域：栅格保持固定占位，正文绝对零重排 */}
			<div className="grid items-start gap-8 lg:grid-cols-[18.5rem_minmax(0,1fr)] lg:gap-14">
				{/* 侧栏插槽固定 18.5rem 占位，避免任何收起导致正文文字宽度跳动 */}
				<div className="relative flex justify-end">
					<aside
						ref={asideRef}
						style={{
							height: isCompact && expandedHeight ? `${expandedHeight}px` : undefined,
						}}
						className={cn(
							"flex flex-col justify-between rounded-2xl border border-edge-hairline/80 bg-background/60 shadow-xs backdrop-blur-xs transition-all duration-300 ease-out lg:sticky lg:top-20",
							isCompact
								? "w-14 overflow-visible px-2 py-4"
								: "w-full overflow-y-auto p-4 lg:max-h-[calc(100vh-6rem)]",
						)}
					>
						<div className="flex-1 overflow-visible">
							<TocVariantView
								variant={variant}
								nodes={TOC_TREE}
								activeId={activeId}
								collapsedIds={collapsedIds}
								onNavigate={onNavigate}
								onToggle={onToggle}
								compact={isCompact}
							/>
						</div>

						{/* 底部阅读锚点指示：展开态与收起态高度等高对应 */}
						<div
							className={cn(
								"mt-3 flex items-center border-t border-border/40 pt-2.5 font-mono text-[10px] text-muted-foreground",
								isCompact ? "justify-center" : "justify-between",
							)}
						>
							{!isCompact && <span>READING ANCHOR</span>}
							<span className="font-semibold text-foreground/80">
								{isCompact
									? activeNumStr
									: `${activeNumStr} / ${String(ALL_SECTION_IDS.length).padStart(2, "0")}`}
							</span>
						</div>
					</aside>
				</div>

				{/* 正文区域稳定固定，阅读排版绝对不动 */}
				<main className="min-w-0">
					<DemoArticle />
				</main>
			</div>
		</div>
	);
}

export const Route = createFileRoute("/lab/toc-tree")({
	component: TocTreeLab,
});
