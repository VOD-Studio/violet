import { AccessibilitySection } from "@features/lab/palette/ui/AccessibilitySection";
import { ChartAndNeonSection } from "@features/lab/palette/ui/ChartAndNeonSection";
import { ComponentPlaygroundSection } from "@features/lab/palette/ui/ComponentPlaygroundSection";
import { type DisplayMode, PaletteHero } from "@features/lab/palette/ui/PaletteHero";
import { StatusMatrixSection } from "@features/lab/palette/ui/StatusMatrixSection";
import { SurfaceLayersSection } from "@features/lab/palette/ui/SurfaceLayersSection";
import { TokenExportSection } from "@features/lab/palette/ui/TokenExportSection";
import { TonalRampSection } from "@features/lab/palette/ui/TonalRampSection";
import { LabHeader } from "@features/lab/ui/LabHeader";
import { useTheme } from "next-themes";
import { useState } from "react";

/**
 * /lab/palette - 冷香紫罗兰色彩系统实验室
 *
 * 全站冷香紫罗兰（Hue 286）调色体系展示页面：
 * 聚合品牌主色、11 阶色阶、明暗双重画布与 5 层表面层级、状态色、
 * 协调图表 5 色、霓虹发光材质、组件实装及 WCAG 2.1 对比度审计。
 */
export function PaletteLab() {
	const { resolvedTheme } = useTheme();
	const [mode, setMode] = useState<DisplayMode>("sync");

	const currentTheme = (resolvedTheme === "dark" ? "dark" : "light") as "light" | "dark";
	const effectiveTheme = mode === "dual" ? currentTheme : mode === "sync" ? currentTheme : mode;

	return (
		<div className="container mx-auto px-6 py-4">
			<LabHeader to="/lab/palette" />

			{/* 快速导航锚点栏 */}
			<div className="mb-10 flex flex-wrap items-center gap-2 border-b border-edge-hairline pb-4 font-mono text-xs">
				<span className="text-muted-foreground uppercase tracking-widest text-[10px] mr-2">
					Index
				</span>
				{[
					{ label: "核心品牌", id: "brand" },
					{ label: "色阶光谱", id: "tonal-ramp" },
					{ label: "空间表面", id: "surfaces" },
					{ label: "状态语义", id: "status" },
					{ label: "图表霓虹", id: "charts" },
					{ label: "组件实装", id: "components" },
					{ label: "无障碍审计", id: "accessibility" },
					{ label: "令牌导出", id: "export" },
				].map((nav) => (
					<a
						key={nav.id}
						href={`#${nav.id}`}
						className="rounded-full border border-edge-hairline bg-card/60 px-3 py-1 text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground"
					>
						{nav.label}
					</a>
				))}
			</div>

			{/* 主视觉看板与模式切换器 */}
			<div id="brand">
				<PaletteHero mode={mode} onModeChange={setMode} resolvedTheme={currentTheme} />
			</div>

			{/* 11 阶紫罗兰色阶 */}
			<div id="tonal-ramp">
				<TonalRampSection />
			</div>

			{/* 双重画布与空间表面体系 */}
			<div id="surfaces">
				<SurfaceLayersSection mode={mode === "dual" ? "dual" : effectiveTheme} />
			</div>

			{/* 状态语义色 */}
			<div id="status">
				<StatusMatrixSection mode={mode === "dual" ? "dual" : effectiveTheme} />
			</div>

			{/* 协调图表光谱与霓虹发光 */}
			<div id="charts">
				<ChartAndNeonSection mode={mode === "dual" ? "dual" : effectiveTheme} />
			</div>

			{/* 组件变体实装演练场 */}
			<div id="components">
				<ComponentPlaygroundSection />
			</div>

			{/* WCAG 对比度全景审计 */}
			<div id="accessibility">
				<AccessibilitySection />
			</div>

			{/* 代码导出 */}
			<div id="export">
				<TokenExportSection />
			</div>
		</div>
	);
}
