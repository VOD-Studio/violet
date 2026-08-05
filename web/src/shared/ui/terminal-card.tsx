import { cn } from "@shared/lib/utils";
import { useEffect, useRef } from "react";

export interface TerminalQuote {
	text: string;
	author?: string;
}

interface TerminalCardProps {
	/** 循环展示的引言列表 */
	quotes: TerminalQuote[];
	/** 终端标题栏路径，默认 ~/violet/status */
	titlePath?: string;
	/** 自定义 className */
	className?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * TerminalCard — 终端风格玻璃拟态卡片，带打字机循环引言
 *
 * 视觉：信号灯 + 毛玻璃 + neon 渐变提示符 + 闪烁光标
 * 行为：逐字打出引言 → 停留 5s → 清空 → 下一条，循环
 * prefers-reduced-motion：直接显示完整文本，不打字
 */
export function TerminalCard({
	quotes,
	titlePath = "~/violet/status",
	className,
}: TerminalCardProps) {
	const textRef = useRef<HTMLSpanElement>(null);
	const authorRef = useRef<HTMLParagraphElement>(null);

	useEffect(() => {
		if (quotes.length === 0) return;
		const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		let cancelled = false;
		let lastIndex = -1;

		const pickNext = (): TerminalQuote => {
			if (quotes.length === 1) return quotes[0];
			let idx = Math.floor(Math.random() * quotes.length);
			while (idx === lastIndex) idx = Math.floor(Math.random() * quotes.length);
			lastIndex = idx;
			return quotes[idx];
		};

		const typeText = async (value: string) => {
			const el = textRef.current;
			if (!el) return;
			if (reducedMotion) {
				el.textContent = value;
				return;
			}
			el.textContent = "";
			for (let i = 1; i <= value.length; i++) {
				if (cancelled) return;
				el.textContent = value.slice(0, i);
				await sleep(20 + Math.floor(Math.random() * 21));
			}
		};

		const showQuote = async (q: TerminalQuote) => {
			const authorEl = authorRef.current;
			if (authorEl) {
				if (q.author) {
					authorEl.textContent = `— ${q.author}`;
					authorEl.classList.remove("hidden");
				} else {
					authorEl.classList.add("hidden");
				}
			}
			await typeText(q.text);
		};

		const run = async () => {
			await showQuote(pickNext());
			if (reducedMotion || cancelled) return;
			while (!cancelled) {
				await sleep(5000);
				if (cancelled) return;
				const textEl = textRef.current;
				const authorEl = authorRef.current;
				if (textEl) textEl.textContent = "";
				if (authorEl) authorEl.textContent = "";
				await sleep(120);
				if (cancelled) return;
				await showQuote(pickNext());
			}
		};

		run();

		return () => {
			cancelled = true;
		};
	}, [quotes]);

	return (
		<aside
			className={cn(
				"flex h-[200px] flex-col overflow-hidden rounded-[1.6rem] border border-edge-hairline backdrop-blur-xl transition-colors duration-200",
				className,
			)}
			style={{
				background: "var(--surface-glass)",
				boxShadow: "0 18px 48px rgba(0,0,0,0.06)",
			}}
		>
			{/* 标题栏 */}
			<div className="flex items-center justify-between border-b border-edge-hairline px-4 py-2.5 backdrop-blur-md">
				<div className="flex items-center gap-1.5">
					<span className="size-2.5 rounded-full bg-red-500/90" />
					<span className="size-2.5 rounded-full bg-amber-400/90" />
					<span className="size-2.5 rounded-full bg-emerald-400/90" />
				</div>
				<p className="m-0 font-mono text-[11px] tracking-[0.08em] text-muted-foreground">
					{titlePath}
				</p>
			</div>

			{/* 终端正文 */}
			<div className="flex flex-1 flex-col px-4 pb-4 pt-3.5 font-mono text-[13px] leading-7">
				<p className="m-0">
					<span className="bg-linear-to-br from-neon-blue to-neon-purple bg-clip-text font-medium text-transparent">
						violet@blog
					</span>
					<span className="ml-[1px] text-muted-foreground">:~$</span>
					<span className="ml-1 text-foreground">quote</span>
				</p>

				<div className="mt-3 flex-1 overflow-y-auto">
					<p className="m-0 break-words text-[13px] leading-7 text-foreground/80">
						<span ref={textRef} />
						<span
							className="ml-0.5 inline-block h-[0.95em] w-[0.36em] animate-pulse rounded-[1px] bg-foreground/60 align-[-0.08em]"
							aria-hidden="true"
						/>
					</p>
					<p
						ref={authorRef}
						className="m-0 mt-2 hidden break-words text-[11px] tracking-[0.04em] text-muted-foreground"
					/>
				</div>
			</div>
		</aside>
	);
}
