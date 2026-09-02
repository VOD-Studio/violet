import { ALL_SECTION_IDS, TOC_TREE, type TocVariant } from "@features/lab/toc/model/article";
import { useActiveSection } from "@features/lab/toc/model/use-active-section";
import { DemoArticle } from "@features/lab/toc/ui/DemoArticle";
import { TocFloatingSwitcher } from "@features/lab/toc/ui/TocFloatingSwitcher";
import { TocVariantView } from "@features/lab/toc/ui/TocVariants";
import { LabHeader } from "@features/lab/ui/LabHeader";
import { cn } from "@shared/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const VARIANTS: { value: TocVariant; label: string; intent: string }[] = [
	{
		value: "liquid",
		label: "流体轨道",
		intent: "流体微光轨道：展开时为高精度标尺与平滑光斑药丸；收起时每根微线与展开标题 1:1 原位几何对齐，高度绝对等高。",
	},
	{
		value: "monograph",
		label: "典藏索表",
		intent: "典藏刊物索表：源自实体刊物排版美学，展开带点状引线与小节符号；收起时化为全量 11 项等宽微章印珠链，高度绝对等高。",
	},
	{
		value: "kinetic",
		label: "生长枝条",
		intent: "贝塞尔生长树：展开为优雅的贝塞尔曲线节点树；收起时聚合成单轨微光纤维晶体，当前节点光环扩散，高度严格等高。",
	},
	{
		value: "capsule",
		label: "分段手风琴",
		intent: "晶体段落手风琴：展开为透光半透明卡片手风琴；收起时退化为垂直胶囊堆叠段，内部子要点微格全量可交互，高度严格等高。",
	},
	{
		value: "minimap",
		label: "空间微地图",
		intent: "空间全景微地图：展开为大纲+微缩雷达双栏联动；收起时为超窄极简雷达光带，视口透镜实时精准追踪，高度严格等高。",
	},
];

/** lg 断点检测：目录在 lg 以下恒为窄轨侧挂（"始终在侧方"），lg 起才允许全宽展开态。 */
function useIsDesktop() {
	const [isDesktop, setIsDesktop] = useState(() =>
		typeof window === "undefined" ? true : window.matchMedia("(min-width: 1024px)").matches,
	);
	useEffect(() => {
		const mq = window.matchMedia("(min-width: 1024px)");
		const onChange = () => setIsDesktop(mq.matches);
		mq.addEventListener("change", onChange);
		return () => mq.removeEventListener("change", onChange);
	}, []);
	return isDesktop;
}

function TocTreeLab() {
	const [variant, setVariant] = useState<TocVariant>("liquid");
	const [isCompact, setIsCompact] = useState(false);
	const reducedMotion = useReducedMotion();
	const [collapsedIds, setCollapsedIds] = useState(() => new Set<string>());
	const isDesktop = useIsDesktop();
	const effectiveCompact = isCompact || !isDesktop;
	const { activeId, navigate } = useActiveSection();
	const asideRef = useRef<HTMLElement>(null);
	const activeItemRef = useRef<HTMLLIElement | null>(null);
	const [expandedHeight, setExpandedHeight] = useState<number | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: 切换方案或折叠状态时需重新捕获当前方案的自然展开高度
	useLayoutEffect(() => {
		if (!effectiveCompact && asideRef.current) {
			const rect = asideRef.current.getBoundingClientRect();
			if (rect.height > 0) {
				setExpandedHeight(Math.round(rect.height));
			}
		}
	}, [effectiveCompact, variant, collapsedIds]);

	// 激活项滚入目录自身视口：树比容器高时高亮不被留在滚动区外（Focus TOC 契约）。
	// variant/effectiveCompact 变化时 ref 重挂到新节点，需重跑；lint 无法识别 ref 语义，显式豁免。
	// biome-ignore lint/correctness/useExhaustiveDependencies: ref 重挂依赖渲染结构变化
	useEffect(() => {
		activeItemRef.current?.scrollIntoView({ block: "nearest" });
	}, [activeId, variant, effectiveCompact]);

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

			{/* 方案设计理念说明；切换入口统一在右下角悬浮器 */}
			<p className="mt-6 mb-8 font-mono text-xs text-muted-foreground">
				<span className="mr-2 tracking-[0.3em] text-muted-foreground/60 uppercase">
					Intent
				</span>
				{VARIANTS.find((v) => v.value === variant)?.intent}
			</p>

			{/* 主展示区域：目录始终在左侧；lg 以下恒为窄轨（effectiveCompact），lg 起可为全宽侧栏。
			    aside 直接作 grid 子项（不套包裹 div）——包裹层高度会收缩为 aside 自身高度，
			    sticky 在其中没有滚动空间，目录会随页面滚走。 */}
			<div className="grid items-start gap-4 grid-cols-[auto_minmax(0,1fr)] md:gap-6 lg:grid-cols-[18.5rem_minmax(0,1fr)] lg:gap-14">
				<aside
					ref={asideRef}
					style={{
						height:
							effectiveCompact && isDesktop && expandedHeight
								? `${expandedHeight}px`
								: undefined,
					}}
					className={cn(
						"sticky top-20 z-30 flex shrink-0 flex-col justify-between rounded-2xl border border-edge-hairline/80 bg-background/60 shadow-xs backdrop-blur-xs transition-all duration-300 ease-out",
						effectiveCompact
							? "max-h-[calc(100vh-6rem)] w-14 overflow-visible px-2 py-4"
							: "max-h-[calc(100vh-6rem)] w-full overflow-y-auto p-4",
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
							compact={effectiveCompact}
							activeItemRef={activeItemRef}
						/>
					</div>

					{/* 底部阅读锚点指示：展开态与收起态高度等高对应 */}
					<div
						className={cn(
							"mt-3 flex items-center border-t border-border/40 pt-2.5 font-mono text-[10px] text-muted-foreground",
							effectiveCompact ? "justify-center" : "justify-between",
						)}
					>
						{!effectiveCompact && <span>READING ANCHOR</span>}
						<span className="font-semibold text-foreground/80">
							{effectiveCompact
								? activeNumStr
								: `${activeNumStr} / ${String(ALL_SECTION_IDS.length).padStart(2, "0")}`}
						</span>
					</div>
				</aside>

				{/* 正文区域稳定固定，阅读排版绝对不动 */}
				<main className="min-w-0">
					<DemoArticle />
				</main>
			</div>

			<TocFloatingSwitcher
				variant={variant}
				variants={VARIANTS}
				onVariantChange={setVariant}
				isCompact={isCompact}
				onToggleCompact={() => setIsCompact((v) => !v)}
			/>
		</div>
	);
}

export const Route = createFileRoute("/lab/toc-tree")({
	component: TocTreeLab,
});
