import { LABS } from "@features/lab/model/registry";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { motion } from "motion/react";

/**
 * LabIndex - /lab 原型实验室索引
 *
 * 实验排程表：刊头左对齐（超大标题 + meta 行），列表弃卡片网格、
 * 改巨大序号 + hairline 行分隔的目录式陈列，hover 整行点亮。
 * 副标题说清 lab 的工作方式：先做几版，择优上线。
 */
export function LabIndex() {
	return (
		<div className="container mx-auto px-6 py-24">
			<header className="mb-16 md:mb-24">
				<div className="mb-4 flex items-center justify-between font-mono text-[11px] tracking-[0.3em] text-muted-foreground uppercase">
					<span>Violet · Design Lab</span>
					<span>{String(LABS.length).padStart(2, "0")} experiments</span>
				</div>
				<h1 className="text-5xl font-bold tracking-tighter md:text-7xl">原型实验室</h1>
				<p className="mt-6 max-w-md text-lg text-muted-foreground">
					每个页面在这里先做几版，选最对的那一版上线。
				</p>
			</header>

			<ul className="border-t border-edge-hairline">
				{LABS.map((lab, i) => (
					<motion.li
						key={lab.to}
						initial={{ opacity: 0, y: 16 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: i * 0.06, duration: 0.5 }}
					>
						<Link
							to={lab.to}
							className="group grid grid-cols-[auto_1fr_auto] items-center gap-5 border-b border-edge-hairline py-7 pr-2 transition-colors hover:bg-muted/40 md:gap-8 md:py-9"
						>
							<span className="w-12 font-mono text-2xl text-muted-foreground/40 transition-colors group-hover:text-neon-blue md:w-16 md:text-4xl">
								{String(i + 1).padStart(2, "0")}
							</span>
							<span className="min-w-0">
								<span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
									<span className="font-mono text-[11px] tracking-[0.3em] text-muted-foreground uppercase">
										{lab.en}
									</span>
									<span className="font-mono text-[11px] text-muted-foreground/60">
										{lab.meta}
									</span>
								</span>
								<h2 className="mt-2 text-xl font-semibold tracking-tight transition-colors group-hover:text-neon-blue md:text-2xl">
									{lab.title}
								</h2>
								<p className="mt-1.5 max-w-lg text-sm leading-relaxed text-muted-foreground">
									{lab.description}
								</p>
							</span>
							<ArrowUpRight className="size-5 shrink-0 text-muted-foreground/40 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-neon-blue" />
						</Link>
					</motion.li>
				))}
			</ul>
		</div>
	);
}
