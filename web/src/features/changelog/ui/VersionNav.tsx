import { cn } from "@shared/lib/utils";
import { useEffect, useRef } from "react";

/** 版本导航项（tag + 锚点 id） */
export interface VersionNavItem {
	tag: string;
	/** 条目总数（新增+修复等合计），用于导航项旁的小字计数 */
	itemCount: number;
}

interface VersionNavProps {
	items: VersionNavItem[];
	/** 线上当前运行版本（数据里的 current_version） */
	current: string;
	/** scroll-spy 追踪到的阅读中版本锚点 id */
	activeId: string | null;
}

/** 版本锚点 id；tag 含点号，getElementById 可处理，无需转义 */
export const versionAnchorId = (tag: string) => `rel-${tag}`;

/**
 * VersionNav - 版本目录导航。
 *
 * 桌面端（lg+）：页面左侧 sticky 竖向列表，左边框指示阅读位置（scroll-spy），
 * 当前运行版本带 primary 圆点。移动端（<lg）：吸顶横向滚动 chip 条
 * （top-16 贴全站 Header 下沿，Header 为 sticky h-16）。
 */
export function VersionNav({ items, current, activeId }: VersionNavProps) {
	const mobileBarRef = useRef<HTMLDivElement>(null);

	// scroll-spy 激活远端版本时，移动端 chip 可能还在横向可视区外——自动滚入居中
	useEffect(() => {
		if (!activeId) return;
		mobileBarRef.current
			?.querySelector(`[data-anchor="${activeId}"]`)
			?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
	}, [activeId]);

	const jump = (tag: string) => {
		document
			.getElementById(versionAnchorId(tag))
			?.scrollIntoView({ behavior: "smooth", block: "start" });
	};

	return (
		<>
			{/* 桌面端：sticky 侧栏 */}
			<nav aria-label="版本目录" className="sticky top-24 hidden self-start lg:block">
				<p className="mb-4 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
					版本
				</p>
				<ul className="space-y-0.5 border-l border-edge-hairline">
					{items.map(({ tag, itemCount }) => {
						const active = activeId === versionAnchorId(tag);
						return (
							<li key={tag}>
								<button
									type="button"
									onClick={() => jump(tag)}
									className={cn(
										"-ml-px flex w-full items-baseline gap-2 border-l-2 py-1.5 pr-2 pl-4 text-left font-mono text-sm transition-colors",
										active
											? "border-primary font-semibold text-foreground"
											: "border-transparent text-muted-foreground hover:text-foreground",
									)}
								>
									{tag}
									{itemCount > 0 ? (
										<span className="text-xs font-normal text-muted-foreground/60">
											{itemCount}
										</span>
									) : null}
									{tag === current ? (
										<span
											role="img"
											aria-label="当前版本"
											className="ml-auto size-1.5 rounded-full bg-primary"
										/>
									) : null}
								</button>
							</li>
						);
					})}
				</ul>
			</nav>

			{/* 移动端：吸顶横向 chip 条 */}
			<nav
				aria-label="版本目录"
				className="sticky top-16 z-40 -mx-6 mb-10 overflow-x-auto border-b border-edge-hairline bg-background/80 backdrop-blur-md lg:hidden"
			>
				<div ref={mobileBarRef} className="flex gap-1.5 px-6 py-2.5">
					{items.map(({ tag }) => {
						const active = activeId === versionAnchorId(tag);
						return (
							<button
								key={tag}
								type="button"
								data-anchor={versionAnchorId(tag)}
								onClick={() => jump(tag)}
								className={cn(
									"shrink-0 rounded-full px-3 py-1 font-mono text-xs transition-colors",
									active
										? "bg-primary/10 font-semibold text-primary"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								{tag}
								{tag === current ? " ·" : ""}
							</button>
						);
					})}
				</div>
			</nav>
		</>
	);
}
