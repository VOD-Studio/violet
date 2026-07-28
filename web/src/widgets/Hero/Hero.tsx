import { motion } from "motion/react";

export default function Hero() {
    return (
        <div className="relative flex h-[100vh] w-full items-center justify-center overflow-hidden">
            {/* 渐变光斑 — 三色（蓝/紫/青），dark 模式切换 screen 混合 */}
            <div className="absolute inset-0 opacity-40 dark:opacity-30">
                <div className="absolute top-1/4 left-1/4 size-96 rounded-full bg-blue-400/30 mix-blend-multiply blur-3xl animate-blob dark:mix-blend-screen" />
                <div className="absolute top-1/3 right-1/4 size-96 rounded-full bg-purple-400/30 mix-blend-multiply blur-3xl animate-blob [animation-delay:2s] dark:mix-blend-screen" />
                <div className="absolute bottom-1/4 left-1/3 size-80 rounded-full bg-cyan-400/20 mix-blend-multiply blur-3xl animate-blob [animation-delay:4s] dark:mix-blend-screen" />
            </div>

            {/* 网格底纹 — 径向遮罩聚焦中心 */}
            <div
                className="absolute inset-0 text-foreground opacity-[0.03]"
                style={{
                    backgroundImage:
                        "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
                    backgroundSize: "64px 64px",
                    maskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
                    WebkitMaskImage:
                        "radial-gradient(ellipse at center, black 30%, transparent 80%)",
                }}
            />

            <div className="z-10 flex flex-col items-center text-center">
                {/* 状态徽章 */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="mb-6 flex items-center gap-2 rounded-full border border-edge-hairline px-4 py-1.5 backdrop-blur-sm"
                    style={{ background: "var(--surface-glass)" }}
                >
                    <span className="relative flex size-2">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-neon-green opacity-75" />
                        <span className="relative inline-flex size-2 rounded-full bg-neon-green" />
                    </span>
                    <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
                        Open Source
                    </span>
                </motion.div>

                <motion.h1
                    initial={{ filter: "blur(10px)", opacity: 0, y: 20 }}
                    animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
                    transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
                    className="mb-4 text-6xl font-black tracking-tighter md:text-8xl"
                >
                    <span className="bg-linear-to-b from-foreground to-foreground/70 bg-clip-text text-transparent">
                        VIOLET BLOG
                    </span>
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1, duration: 1 }}
                    className="font-mono text-sm tracking-[0.3em] text-muted-foreground uppercase md:text-lg"
                >
                    Building the new way
                </motion.p>
            </div>

            <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="absolute bottom-10 flex flex-col items-center opacity-50"
            >
                <span className="mb-2 text-xs">Scroll</span>
                <div className="h-8 w-[1px] bg-foreground" />
            </motion.div>
        </div>
    );
}
