import { getDisplayName } from "@entities/user/model/display-name";
import type { Post } from "@features/posts/model/types";
import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { motion, useReducedMotion } from "motion/react";
import { useMemo } from "react";

const WEEKDAY = ["一", "二", "三", "四", "五", "六", "日"];

/**
 * DailyDigest - 日刊分组
 *
 * newsletter 式按天分组单栏：左侧日期立头（衬线大日期 + 星期），右侧当日
 * 条目（时间 · 标题 · 作者），天与天之间粗细线分隔。以「发行日」为组织
 * 轴，零图片，信息密度介于目录与轨道之间。
 */
export function DailyDigest({ posts }: { posts: Post[] }) {
	const reduce = useReducedMotion();

	const days = useMemo(() => {
		const map = new Map<string, Post[]>();
		for (const p of posts) {
			const key = format(new Date(p.published_at), "yyyy-MM-dd");
			const list = map.get(key);
			if (list) list.push(p);
			else map.set(key, [p]);
		}
		return [...map.entries()];
	}, [posts]);

	return (
		<div>
			{days.map(([day, list], di) => {
				const d = new Date(day);
				return (
					<motion.section
						key={day}
						initial={reduce ? false : { opacity: 0 }}
						whileInView={{ opacity: 1 }}
						viewport={{ once: true }}
						transition={{ duration: 0.4, delay: Math.min(di, 4) * 0.05 }}
						className="border-b-2 border-t border-edge-hairline py-6 first:border-t-2 first:border-t-foreground md:grid md:grid-cols-[110px_1fr] md:gap-8"
					>
						{/* 日期立头 */}
						<div className="mb-4 md:mb-0">
							<p className="font-serif text-4xl leading-none font-black tracking-tight">
								{format(d, "dd")}
							</p>
							<p className="mt-2 font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
								{format(d, "yyyy.MM")} · 周
								{WEEKDAY[d.getDay() === 0 ? 6 : d.getDay() - 1]}
							</p>
						</div>

						{/* 当日条目 */}
						<ul>
							{list.map((p, i) => (
								<li key={p.id} className={i > 0 ? "mt-3.5" : ""}>
									<Link
										to="/blog/$slug"
										params={{ slug: p.slug }}
										className="group flex items-baseline gap-4"
									>
										<time className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
											{format(new Date(p.published_at), "HH:mm")}
										</time>
										<span className="min-w-0 flex-1 truncate font-medium transition-colors group-hover:text-neon-blue">
											{p.title}
										</span>
										<span className="hidden shrink-0 font-mono text-[11px] text-muted-foreground sm:block">
											{p.author ? getDisplayName(p.author) : "佚名"}
										</span>
									</Link>
								</li>
							))}
						</ul>
					</motion.section>
				);
			})}
			<p className="mt-6 font-mono text-[11px] text-muted-foreground/60">
				共 {days.length} 期 · {posts.length} 篇 ·{" "}
				{format(new Date(), "yyyy-MM-dd", { locale: zhCN })} 刊
			</p>
		</div>
	);
}
