import { motion } from "motion/react";
import type { AboutSectionProps } from "./AboutSectionPlaceholder";

/**
 * SkillsSection - A3 技能/兴趣标签云（升级版三组）
 *
 * 把 skills_strong / skills_learning / skills_interests 三组字符串（逗号/顿号分隔）
 * 解析成标签，分组渲染，各组配不同色相。空组不渲染。
 */
export function SkillsSection({ settings }: AboutSectionProps) {
	const groups = [
		{
			title: "擅长",
			raw: settings.skills_strong,
			color: "hover:border-blue-500/50 hover:bg-blue-500/10",
		},
		{
			title: "在学",
			raw: settings.skills_learning,
			color: "hover:border-amber-500/50 hover:bg-amber-500/10",
		},
		{
			title: "兴趣",
			raw: settings.skills_interests,
			color: "hover:border-purple-500/50 hover:bg-purple-500/10",
		},
	]
		.map((g) => ({
			...g,
			tags: g.raw
				? g.raw
						.split(/[,，、\s]+/)
						.map((s) => s.trim())
						.filter(Boolean)
				: [],
		}))
		.filter((g) => g.tags.length > 0);

	if (groups.length === 0) return null;

	return (
		<section className="mx-auto w-full max-w-5xl px-6 py-14">
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				whileInView={{ opacity: 1, y: 0 }}
				viewport={{ once: true }}
				transition={{ duration: 0.6 }}
				className="space-y-8"
			>
				{groups.map((group) => (
					<div key={group.title}>
						<h2 className="mb-4 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
							{group.title}
						</h2>
						<div className="flex flex-wrap gap-2">
							{group.tags.map((tag, i) => (
								<motion.span
									key={tag}
									initial={{ opacity: 0, scale: 0.8 }}
									whileInView={{ opacity: 1, scale: 1 }}
									viewport={{ once: true }}
									transition={{ duration: 0.3, delay: i * 0.03 }}
									className={`rounded-lg border border-edge-hairline bg-muted/30 px-3 py-1.5 font-mono text-sm transition-colors ${group.color}`}
								>
									{tag}
								</motion.span>
							))}
						</div>
					</div>
				))}
			</motion.div>
		</section>
	);
}
