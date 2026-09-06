import type { SiteSettings } from "@features/settings/model/types";
import { Heart, Rss } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";

interface HomeClosingProps {
	settings: SiteSettings | null;
}

/** 依月份生成温润应季寄语。 */
function getSeasonalGreeting(): { title: string; subtitle: string } {
	const month = new Date().getMonth() + 1;
	if (month >= 3 && month <= 5) return { title: "花朝如约", subtitle: "春山可望" };
	if (month >= 6 && month <= 8) return { title: "熏风入弦", subtitle: "荷风送香" };
	if (month >= 9 && month <= 11) return { title: "桂月流光", subtitle: "掬光以待" };
	return { title: "梅信岁寒", subtitle: "围炉夜话" };
}

/** 首页收尾诗意落幕与自然过渡层。 */
export function HomeClosing({ settings }: HomeClosingProps) {
	const greeting = getSeasonalGreeting();
	const [hearted, setHearted] = useState(false);
	const [heartCount, setHeartCount] = useState(4084);

	const handleHeart = () => {
		if (!hearted) {
			setHearted(true);
			setHeartCount((prev) => prev + 1);
		}
	};

	return (
		<section className="relative overflow-hidden pt-28 pb-16 sm:pt-32 sm:pb-20 lg:pt-36 lg:pb-24">
			<motion.div
				initial={false}
				whileInView={{ opacity: 1, y: 0 }}
				viewport={{ once: true, amount: 0.3 }}
				transition={{ type: "spring", stiffness: 130, damping: 22, mass: 0.9 }}
				className="mx-auto max-w-4xl px-5 text-center sm:px-8"
			>
				{/* 诗意寄语大字 */}
				<div className="space-y-2">
					<p className="font-serif text-2xl font-normal tracking-[0.1em] text-foreground/90 sm:text-3xl">
						{greeting.title}
					</p>
					<h2 className="font-serif text-2xl font-normal tracking-[0.08em] text-foreground/90 sm:text-3xl">
						{greeting.subtitle}
					</h2>
				</div>

				{/* 中段：留下印记 与 订阅通信 双核单元 */}
				<div className="mt-14 flex items-center justify-center gap-8 sm:gap-14">
					{/* 左：留下印记 */}
					<button
						type="button"
						onClick={handleHeart}
						className="group flex flex-col items-center gap-1.5 transition-transform duration-200 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
					>
						<span className="text-xs text-muted-foreground/80 transition-colors group-hover:text-foreground">
							留下印记
						</span>
						<span className="inline-flex items-center gap-1.5 font-mono text-xs text-foreground/80 transition-colors group-hover:text-primary">
							<Heart
								className={`size-3.5 transition-all duration-200 ${
									hearted
										? "fill-primary text-primary scale-110"
										: "text-muted-foreground/60 group-hover:text-primary group-hover:scale-110"
								}`}
							/>
							<span className="tabular-nums">{heartCount}</span>
						</span>
					</button>

					{/* 竖向分隔微线 */}
					<div aria-hidden className="h-8 w-px bg-border/40" />

					{/* 右：订阅通信 */}
					<a
						href={settings?.social_rss || "/feed.xml"}
						className="group flex flex-col items-center gap-1.5 transition-transform duration-200 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
					>
						<span className="text-xs text-muted-foreground/80 transition-colors group-hover:text-foreground">
							订阅通信
						</span>
						<span className="inline-flex items-center gap-1.5 text-xs text-foreground/80 transition-colors group-hover:text-primary">
							<Rss className="size-3 text-muted-foreground/60 transition-colors group-hover:text-primary" />
							<span className="font-normal tracking-wide text-muted-foreground/80 group-hover:text-foreground">
								不错过每一纸书。
							</span>
						</span>
					</a>
				</div>
			</motion.div>
		</section>
	);
}
