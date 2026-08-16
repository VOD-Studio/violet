import ThemeToggle, { type ThemeVariant } from "@features/lab/theme/ui";
import { Segmented } from "@shared/ui/segmented";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";

const DIRECTIONS: { value: ThemeVariant; label: string; intent: string }[] = [
	{
		value: "segmented",
		label: "三段拨动",
		intent: "三段胶囊滑块，滑块滑移指示当前主题，图标加文字。生产 Header 现役方案，最稳。",
	},
	{
		value: "rotary",
		label: "旋钮",
		intent: "点击中心后三个选项按 120° 扇形弹出，选后收拢并更新中心图标，弹出式保证点击区域够大。",
	},
	{
		value: "pie",
		label: "三分圆盘",
		intent: "SVG 三等分圆盘展开，每个 120° 扇区对应一个主题，选中后收拢回中心图标。",
	},
	{
		value: "cyclic",
		label: "单键循环",
		intent: "单按钮循环三态，图标缩放旋转形变，点击位置作圆形扩散起点。最省空间。",
	},
	{
		value: "orbiting",
		label: "天体轨道",
		intent: "当前主题居中为主星，另两颗小行星沿椭圆轨道运行，点击小行星与主星交换位置。",
	},
	{
		value: "cube",
		label: "翻转立方",
		intent: "立方体三个面对应三态，点击沿 Y 轴转到对应面，面色微差增强 3D 可读性。",
	},
	{
		value: "scene",
		label: "情景插画",
		intent: "按钮内是微缩场景，亮时太阳高挂、暗时月亮星星升起，点击循环三态。叙事感最强。",
	},
];

/**
 * /lab/theme - 主题切换器实验室
 *
 * 与其他 lab 同构：方向切换 Segmented + Intent 行 + 近生产预览框。
 * 预览框上半是页头实景（sm 尺寸，切换器的生产位在站点 Header 右侧），
 * 下半是 default 尺寸的居中交互台。控件无数据态，不设骨架/空态切换。
 */
function ThemeLab() {
	const [direction, setDirection] = useState<ThemeVariant>("segmented");
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
				<h1 className="mb-4 text-4xl font-bold tracking-tight">主题切换器实验室</h1>
				<p className="mx-auto max-w-xl text-muted-foreground">七种主题切换控件逐一试用。</p>
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
						Preview · violet.blog · {active.label}
					</p>

					{/* 页头实景：切换器的生产位是站点 Header 右侧操作区 */}
					<div className="flex items-center justify-between border-b border-edge-hairline pb-4">
						<p className="pl-[0.22em] font-serif text-lg font-black tracking-[0.22em]">
							VIOLET
						</p>
						<ThemeToggle variant={direction} size="sm" />
					</div>

					{/* 交互台：default 尺寸居中，预留扇形弹出/轨道/立方所需空间；key 随方向重挂载复位内部开合态 */}
					<div key={direction} className="flex items-center justify-center py-20">
						<ThemeToggle variant={direction} size="default" />
					</div>
				</div>
			</section>
		</div>
	);
}

export const Route = createFileRoute("/lab/theme")({
	component: ThemeLab,
});
