import { BackLink } from "@features/lab/nav/ui/BackLink";
import ThemeToggle, { type ThemeSize, type ThemeVariant } from "@features/lab/theme/ui";
import { Segmented } from "@shared/ui/segmented";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

const DIRECTIONS: { value: ThemeVariant; label: string; intent: string }[] = [
	{
		value: "segmented",
		label: "三段拨动",
		intent: "三段胶囊滑块，滑块滑移指示当前主题，图标加文字。生产 Header 现役方案，最稳。",
	},
	{
		value: "cyclic",
		label: "单键循环",
		intent: "单按钮循环三态，图标缩放旋转形变，点击位置作圆形扩散起点。最省空间。",
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

/** 尺寸陈列档位：lg 是展示位大尺寸，sm 是 Header 生产尺寸 */
const SIZE_LADDER: { size: ThemeSize; label: string }[] = [
	{ size: "lg", label: "大" },
	{ size: "default", label: "默认" },
	{ size: "sm", label: "小" },
];

/**
 * /lab/theme - 主题切换器实验室
 *
 * 与其他 lab 同构：方向切换 Segmented + Intent 行 + 近生产预览框。
 * theme 的预览是尺寸陈列：当前方向按 大 / 默认 / 小 三档纵向排列，
 * 标签右对齐成阶梯读出比例关系。控件无数据态，不设骨架/空态切换。
 */
function ThemeLab() {
	const [direction, setDirection] = useState<ThemeVariant>("segmented");
	const active = DIRECTIONS.find((d) => d.value === direction) ?? DIRECTIONS[0];

	return (
		<div className="container mx-auto px-6 py-24">
			<div className="mb-16 text-center">
				<BackLink to="/lab" label="Labs" className="mb-6" />
				<h1 className="mb-4 text-4xl font-bold tracking-tight">主题切换器实验室</h1>
				<p className="mx-auto max-w-xl text-muted-foreground">
					四种主题切换控件，按大、默认、小三档陈列。
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
						Preview · violet.blog · {active.label}
					</p>

					{/* 尺寸陈列：key 随方向重挂载，复位立方体朝向等内部状态 */}
					<div key={direction} className="flex flex-col items-center gap-10 py-14">
						{SIZE_LADDER.map(({ size, label }) => (
							<div key={size} className="flex items-center justify-center gap-6">
								<span className="w-8 text-right font-mono text-[10px] tracking-[0.2em] text-muted-foreground/70">
									{label}
								</span>
								<ThemeToggle variant={direction} size={size} />
							</div>
						))}
					</div>
				</div>
			</section>
		</div>
	);
}

export const Route = createFileRoute("/lab/theme")({
	component: ThemeLab,
});
