import { motion } from "motion/react";
import type { AboutSectionProps } from "./AboutSectionPlaceholder";

/**
 * HeroSection - About 页顶部 Hero 区（站点名）
 *
 * 渐变光斑背景 + 大字站名。从原默认渲染抽取为独立区块组件。
 */
export function HeroSection({ settings }: AboutSectionProps) {
	return (
		<section className="relative flex h-[60vh] items-center justify-center overflow-hidden bg-background">
			<div className="absolute inset-0 opacity-30">
				<div className="absolute top-1/4 left-1/4 size-96 rounded-full bg-[radial-gradient(circle,rgba(96,165,250,0.32),rgba(96,165,250,0.12)_45%,transparent_70%)] dark:bg-[radial-gradient(circle,rgba(96,165,250,0.38),rgba(96,165,250,0.14)_45%,transparent_70%)] motion-safe:animate-blob" />
				<div className="absolute top-1/3 right-1/4 size-96 rounded-full bg-[radial-gradient(circle,rgba(192,132,252,0.30),rgba(192,132,252,0.10)_45%,transparent_70%)] dark:bg-[radial-gradient(circle,rgba(192,132,252,0.38),rgba(192,132,252,0.14)_45%,transparent_70%)] motion-safe:animate-blob [animation-delay:2s]" />
			</div>

			<div className="z-10 flex flex-col items-center px-6 text-center">
				<motion.p
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.8 }}
					className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground"
				>
					About
				</motion.p>
				<motion.h1
					initial={{ filter: "blur(10px)", opacity: 0, y: 20 }}
					animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
					transition={{ duration: 1.2, ease: "easeOut" }}
					className="mb-4 text-5xl font-black tracking-tighter md:text-7xl"
				>
					{settings.site_name || "关于"}
				</motion.h1>
			</div>
		</section>
	);
}
