import { createFileRoute } from "@tanstack/react-router";
import {
	CubeToggle,
	CyclicThemeButton,
	OrbitingPlanets,
	PieMenuToggle,
	RotaryDial,
	SceneButton,
	SegmentedToggle,
} from "@widgets/ThemeToggle/variants";

/**
 * ThemeLab - 主题切换器实验页
 *
 * 并排展示七种创意主题切换器原型，方便对比挑选。
 */
function ThemeLab() {
	const cards = [
		{ title: "1. 三段拨动", description: "SegmentedToggle", component: SegmentedToggle },
		{ title: "2. 旋钮", description: "RotaryDial", component: RotaryDial },
		{ title: "3. 三分圆盘", description: "PieMenuToggle", component: PieMenuToggle },
		{ title: "4. 单键循环", description: "CyclicThemeButton", component: CyclicThemeButton },
		{ title: "5. 天体轨道", description: "OrbitingPlanets", component: OrbitingPlanets },
		{ title: "6. 翻转立方", description: "CubeToggle", component: CubeToggle },
		{ title: "7. 情景插画", description: "SceneButton", component: SceneButton },
	];

	return (
		<div className="container mx-auto px-6 py-24">
			<div className="mb-16 text-center">
				<h1 className="mb-4 text-4xl font-bold tracking-tight">主题切换器实验室</h1>
				<p className="mx-auto max-w-xl text-muted-foreground">
					点击任意控件切换主题，观察交互手感与动画效果。
				</p>
			</div>

			<div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
				{cards.map((card) => {
					const Component = card.component;
					return (
						<div
							key={card.title}
							className="flex flex-col items-center rounded-2xl border border-border bg-card p-8 shadow-sm"
						>
							<h2 className="mb-1 text-lg font-semibold">{card.title}</h2>
							<p className="mb-8 text-sm text-muted-foreground">{card.description}</p>
							<div className="flex h-48 w-full items-center justify-center rounded-xl bg-muted/50">
								<Component />
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

export const Route = createFileRoute("/theme-lab")({
	component: ThemeLab,
});
