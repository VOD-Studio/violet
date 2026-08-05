import { motion } from "motion/react";
import type { AboutSectionProps } from "./AboutSectionPlaceholder";

/**
 * BioSection - 个人简介
 *
 * 较长正文简介（settings.bio）。与 AvatarTaglineSection 的短标语互补。
 */
export function BioSection({ settings }: AboutSectionProps) {
	if (!settings.bio) return null;

	return (
		<section className="mx-auto w-full max-w-5xl px-6 py-14">
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				whileInView={{ opacity: 1, y: 0 }}
				viewport={{ once: true }}
				transition={{ duration: 0.6 }}
			>
				<h2 className="mb-6 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
					简介
				</h2>
				<p className="whitespace-pre-line text-lg leading-relaxed text-foreground/80">
					{settings.bio}
				</p>
			</motion.div>
		</section>
	);
}
