import { ParticleField } from "@shared/ui/particle-field";
import { TerminalCard, type TerminalQuote } from "@shared/ui/terminal-card";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";

const TERMINAL_QUOTES: TerminalQuote[] = [
    { text: "Talk is cheap. Show me the code.", author: "Linus Torvalds" },
    { text: "Make it work, make it right, make it fast.", author: "Kent Beck" },
    { text: "Simplicity is the soul of efficiency.", author: "Austin Freeman" },
    { text: "First, solve the problem. Then, write the code.", author: "John Johnson" },
    { text: "Premature optimization is the root of all evil.", author: "Donald Knuth" },
    { text: "Code is like humor. When you have to explain it, it's bad.", author: "Cory House" },
    { text: "The best error message is the one that never shows up.", author: "Thomas Fuchs" },
    { text: "Programs must be written for people to read.", author: "Harold Abelson" },
];

/**
 * LandingHero — 首页着陆区 widget
 *
 * 组合 ParticleField（粒子背景）+ TerminalCard（终端引言）
 * 左栏：品牌名两色调 + 描述 + 分类 pill + CTA + 社交
 * 右栏：终端卡片（打字机循环引言）
 */
export default function LandingHero() {
    return (
        <>
            <ParticleField density={0.45} heightVh={80} />

            <section className="relative overflow-hidden">
                {/* 渐变光斑 */}
                <div className="absolute inset-0 opacity-40 dark:opacity-30">
                    <div className="absolute top-1/4 left-1/4 size-96 rounded-full bg-blue-400/30 mix-blend-multiply blur-3xl animate-blob dark:mix-blend-screen" />
                    <div className="absolute top-1/3 right-1/4 size-96 rounded-full bg-purple-400/30 mix-blend-multiply blur-3xl animate-blob [animation-delay:2s] dark:mix-blend-screen" />
                </div>

                <div className="container relative z-10 mx-auto px-4 py-20 md:px-6 md:py-28">
                    <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-[minmax(0,1fr)_auto]">
                        {/* 左：品牌信息 */}
                        <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="max-w-[40rem]"
                            style={{ fontVariantLigatures: "contextual" }}
                        >
                            <h1 className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono">
                                <span className="text-[2.5rem] font-bold leading-none tracking-tight md:text-[3.4rem]">
                                    MIMO
                                </span>
                                <span className="text-[2.5rem] font-bold italic leading-none tracking-tight text-muted-foreground md:text-[3.4rem]">
                                    Blog
                                </span>
                            </h1>

                            <p className="mt-3 max-w-xl font-mono text-[14px] leading-7 text-muted-foreground">
                                全栈博客平台 · React · Go · PostgreSQL
                            </p>

                            <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                                {["前端", "后端", "工程实践"].map((label) => (
                                    <span
                                        key={label}
                                        className="rounded-full border border-edge-hairline px-3 py-1"
                                        style={{ background: "var(--surface-glass)" }}
                                    >
                                        {label}
                                    </span>
                                ))}
                            </div>

                            <div className="mt-7 flex flex-wrap items-center gap-2.5">
                                <Link
                                    to="/blog"
                                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-105"
                                >
                                    浏览博客
                                    <ArrowRight className="size-4" />
                                </Link>
                                <Link
                                    to="/about"
                                    className="inline-flex items-center gap-2 rounded-xl border border-edge-hairline px-5 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
                                    style={{ background: "var(--surface-glass)" }}
                                >
                                    关于
                                </Link>
                                <a
                                    href="https://github.com"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex size-10 items-center justify-center rounded-xl border border-edge-hairline text-muted-foreground transition-colors hover:text-foreground"
                                    style={{ background: "var(--surface-glass)" }}
                                    aria-label="GitHub"
                                >
                                    <svg
                                        viewBox="0 0 24 24"
                                        className="size-4 fill-current"
                                        aria-hidden="true"
                                    >
                                        <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.523 2 12 2z" />
                                    </svg>
                                    <span className="sr-only">GitHub</span>
                                </a>
                            </div>
                        </motion.div>

                        {/* 右：终端卡片 */}
                        <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                            className="w-full max-w-sm justify-self-start md:justify-self-end"
                        >
                            <TerminalCard quotes={TERMINAL_QUOTES} />
                        </motion.div>
                    </div>
                </div>
            </section>
        </>
    );
}
