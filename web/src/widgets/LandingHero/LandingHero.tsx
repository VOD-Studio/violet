import { GithubIcon } from "@shared/ui/icons";
import { ParticleField } from "@shared/ui/particle-field";
import { TerminalCard, type TerminalQuote } from "@shared/ui/terminal-card";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

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
 * 入场动画纯 CSS（blur-in + clip-reveal），不用 Framer Motion，零 JS 开销。
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
					<div className="absolute top-1/4 left-1/4 size-96 rounded-full bg-[radial-gradient(circle,rgba(96,165,250,0.32),rgba(96,165,250,0.12)_45%,transparent_70%)] dark:bg-[radial-gradient(circle,rgba(96,165,250,0.38),rgba(96,165,250,0.14)_45%,transparent_70%)] motion-safe:animate-blob" />
					<div className="absolute top-1/3 right-1/4 size-96 rounded-full bg-[radial-gradient(circle,rgba(192,132,252,0.30),rgba(192,132,252,0.10)_45%,transparent_70%)] dark:bg-[radial-gradient(circle,rgba(192,132,252,0.38),rgba(192,132,252,0.14)_45%,transparent_70%)] motion-safe:animate-blob [animation-delay:2s]" />
				</div>

				<div className="container relative z-10 mx-auto px-4 py-20 md:px-6 md:py-28">
					<div className="grid grid-cols-1 items-center gap-12 md:grid-cols-[minmax(0,1fr)_auto]">
						{/* 左：品牌信息 */}
						<div className="max-w-160">
							<h1 className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono">
								<span className="text-[2.5rem] font-bold leading-none tracking-tight md:text-[3.4rem]">
									VIOLET
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
									className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-transform"
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
									<GithubIcon className="size-4" />
									<span className="sr-only">GitHub</span>
								</a>
							</div>
						</div>

						{/* 右：终端卡片 */}
						<div className="w-full max-w-sm justify-self-start md:justify-self-end">
							<TerminalCard quotes={TERMINAL_QUOTES} />
						</div>
					</div>
				</div>
			</section>
		</>
	);
}
