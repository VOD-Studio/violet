import { LABS } from "@features/lab/model/registry";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

/**
 * LabIndex - /lab 原型实验室索引
 *
 * 全站 *-lab 的统一入口：注册表驱动的卡片网格，卡片语言对齐站内
 * 内容页（mono 小签 + hairline 卡 + hover 霓虹标题）。
 */
export function LabIndex() {
	return (
		<div className="container mx-auto px-6 py-24">
			<div className="mb-16 text-center">
				<p className="mb-2 font-mono text-xs tracking-[0.3em] text-muted-foreground uppercase">
					Lab
				</p>
				<h1 className="mb-4 text-4xl font-bold tracking-tight">原型实验室</h1>
				<p className="mx-auto max-w-xl text-muted-foreground">
					页面级候选方案的对比工作台：每个实验室并排渲染同一功能的多套设计，选定方向后按此实现正式页面。
				</p>
			</div>

			<div className="grid gap-4 md:grid-cols-2">
				{LABS.map((lab) => (
					<Link
						key={lab.to}
						to={lab.to}
						className="group flex flex-col rounded-2xl border border-edge-hairline bg-background/40 p-6 transition-colors hover:border-foreground/30 md:p-8"
					>
						<div className="flex items-baseline justify-between">
							<p className="font-mono text-[11px] tracking-[0.3em] text-muted-foreground uppercase">
								{lab.en}
							</p>
						</div>
						<h2 className="mt-3 text-xl font-semibold tracking-tight transition-colors group-hover:text-neon-blue">
							{lab.title}
						</h2>
						<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
							{lab.description}
						</p>
						<div className="mt-auto flex items-center justify-between pt-6">
							<p className="font-mono text-[11px] text-muted-foreground">
								{lab.meta}
							</p>
							<ArrowRight className="size-4 text-muted-foreground/50 transition-all group-hover:translate-x-0.5 group-hover:text-neon-blue" />
						</div>
					</Link>
				))}
			</div>
		</div>
	);
}
