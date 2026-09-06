import type { SiteSettings } from "@features/settings/model/types";
import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
	Archive,
	ArrowUpRight,
	BookOpenText,
	FileText,
	FlaskConical,
	Images,
	MessageCircle,
	NotebookPen,
	Rss,
	Users,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

interface HomeClosingProps {
	settings: SiteSettings | null;
}

type DiscoveryPath =
	| "/blog"
	| "/series"
	| "/notes"
	| "/galleries"
	| "/tweets"
	| "/friends"
	| "/projects"
	| "/blog/archive";

interface DiscoveryLink {
	to: DiscoveryPath;
	label: string;
	subLabel: string;
	Icon: LucideIcon;
}

const DISCOVERY_LINKS: DiscoveryLink[] = [
	{ to: "/blog", label: "文章", subLabel: "ARTICLES", Icon: FileText },
	{ to: "/notes", label: "笔记", subLabel: "NOTES", Icon: NotebookPen },
	{ to: "/series", label: "系列", subLabel: "SERIES", Icon: BookOpenText },
	{ to: "/galleries", label: "图集", subLabel: "GALLERIES", Icon: Images },
	{ to: "/tweets", label: "推文", subLabel: "TWEETS", Icon: MessageCircle },
	{ to: "/friends", label: "朋友们", subLabel: "FRIENDS", Icon: Users },
	{ to: "/projects", label: "项目", subLabel: "PROJECTS", Icon: FlaskConical },
	{ to: "/blog/archive", label: "时间归档", subLabel: "ARCHIVE", Icon: Archive },
];

/** 散落微星尘光点（对齐氛围自然过渡质感）。 */
const AMBIENT_PARTICLES = [
	{ id: "p1", left: "8.5%", top: "38%", size: 2.5, opacity: 0.35, blur: "0.4px" },
	{ id: "p2", left: "28.2%", top: "62%", size: 2, opacity: 0.25, blur: "0.5px" },
	{ id: "p3", left: "51.4%", top: "18%", size: 3, opacity: 0.45, blur: "0.3px" },
	{ id: "p4", left: "76.8%", top: "54%", size: 2, opacity: 0.3, blur: "0.5px" },
	{ id: "p5", left: "89.3%", top: "26%", size: 3.5, opacity: 0.55, blur: "0.3px" },
];

/** 首页收尾探索站台与自然消融过渡层。 */
export function HomeClosing({ settings }: HomeClosingProps) {
	const reduceMotion = useReducedMotion();

	return (
		<section className="relative overflow-hidden pt-24 sm:pt-28 lg:pt-32">
			<motion.div
				initial={false}
				whileInView={{ opacity: 1, y: 0 }}
				viewport={{ once: true, amount: 0.25 }}
				transition={{ type: "spring", stiffness: 130, damping: 22, mass: 0.9 }}
				className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12"
			>
				{/* 标头区 */}
				<div className="flex flex-col items-center text-center">
					<p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/60">
						EXPLORATION
					</p>
					<h2 className="mt-2 text-2xl font-normal tracking-[-0.01em] text-foreground sm:text-3xl">
						继续逛逛
					</h2>
					<p className="mt-3.5 max-w-lg text-sm leading-relaxed text-muted-foreground/80">
						文章之外，还有随手记录、视觉图像、实践项目与站内来往。
					</p>

					{/* 探索胶囊卡片网格 */}
					<nav aria-label="首页探索导航" className="mt-12 w-full max-w-3xl">
						<ul className="grid grid-cols-2 gap-3.5 sm:grid-cols-4 sm:gap-4">
							{DISCOVERY_LINKS.map(({ to, label, subLabel, Icon }, index) => (
								<motion.li
									key={to}
									initial={false}
									whileInView={{ opacity: 1, y: 0 }}
									viewport={{ once: true }}
									transition={{
										type: "spring",
										stiffness: 160,
										damping: 18,
										delay: reduceMotion ? 0 : index * 0.035,
									}}
								>
									<Link
										to={to}
										className="group relative flex items-center gap-3 rounded-2xl border border-border/50 bg-card/40 p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card hover:shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
									>
										<div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
											<Icon className="size-4 transition-transform duration-200 group-hover:scale-110" />
										</div>
										<div className="min-w-0 flex-1 text-left">
											<span className="block truncate text-xs font-medium text-foreground transition-colors group-hover:text-primary sm:text-sm">
												{label}
											</span>
											<span className="block font-mono text-[9px] tracking-wider text-muted-foreground/60">
												{subLabel}
											</span>
										</div>
										<ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground/20 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
									</Link>
								</motion.li>
							))}
						</ul>
					</nav>

					{/* RSS 独立订阅触点 */}
					{settings?.social_rss ? (
						<div className="mt-10">
							<a
								href={settings.social_rss}
								className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground transition-all duration-200 hover:border-primary/30 hover:bg-muted/70 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
							>
								<Rss className="size-3.5 text-primary" />
								订阅 RSS 更新
							</a>
						</div>
					) : null}
				</div>
			</motion.div>

			{/* 底部消融交接带（Atmospheric Dissolving Transition，对齐参考稿质感） */}
			<div
				aria-hidden
				className="pointer-events-none relative mt-16 h-36 w-full sm:h-44 lg:h-52"
			>
				{/* 温暖柔和的径向消融光晕 */}
				<div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,color-mix(in_oklab,var(--color-primary)_4%,transparent),transparent_75%)]" />

				{/* 渐进式淡化下沉过渡 */}
				<div className="absolute inset-0 bg-linear-to-b from-transparent via-background/40 to-background" />

				{/* 微星尘浮散点缀 */}
				{AMBIENT_PARTICLES.map((particle) => (
					<motion.span
						key={particle.id}
						initial={false}
						animate={
							reduceMotion
								? undefined
								: {
										opacity: [
											particle.opacity * 0.7,
											particle.opacity,
											particle.opacity * 0.7,
										],
										y: [0, -3, 0],
									}
						}
						transition={{
							duration: 4.5,
							repeat: Number.POSITIVE_INFINITY,
							ease: "easeInOut",
							delay: Math.random() * 2,
						}}
						style={{
							left: particle.left,
							top: particle.top,
							width: particle.size,
							height: particle.size * 1.6,
							filter: `blur(${particle.blur})`,
						}}
						className="absolute rounded-full bg-amber-400/80 shadow-[0_0_8px_rgba(251,191,36,0.3)] dark:bg-amber-300/80"
					/>
				))}
			</div>
		</section>
	);
}
