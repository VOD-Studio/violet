import { Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight, Search } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/shared/lib/utils";
import { OverlayScroll } from "@/shared/ui/overlay-scroll";

import { useOpenApiSpec } from "../api/useOpenApiSpec";
import { buildDocsModel, operationMatches } from "../lib/build-docs-model";
import type { DocChapter, DocsModel } from "../model/types";
import { OperationRow } from "./OperationRow";

interface ApiReferenceProps {
	/** dialog：弹窗内嵌（压缩留白、内边距交给纸壳）；page：独立页全幅 */
	variant: "page" | "dialog";
}

/** 首页同款 spring 参数，章节滚入视口时复用。 */
const REVEAL_SPRING = { type: "spring" as const, stiffness: 130, damping: 21, mass: 0.9 };

/** 章节锚点 id；以册内序号命名，规避中文 tag 的 URL 编码差异。 */
function chapterAnchor(prefix: string, marker: string): string {
	return `docs-${prefix}-${marker}`;
}

/**
 * API 文档渲染器：公开端点为正文、/admin 端点为折叠附录。
 * 弹窗排版为「书卷总目」：左栏 sticky 总目（scroll-spy 高亮 + 点线引导），
 * 右栏词条正文；关键字过滤命中 path/摘要/tag，过滤态收起总目全幅聚焦。
 */
export function ApiReference({ variant }: ApiReferenceProps) {
	const { data, isLoading, isError } = useOpenApiSpec();
	const [query, setQuery] = useState("");
	const [activeTag, setActiveTag] = useState<string | null>(null);
	const [appendixOpen, setAppendixOpen] = useState(false);
	const model = useMemo(() => (data ? buildDocsModel(data) : null), [data]);
	const filtering = query.trim().length > 0;

	// scroll-spy 的观察目标：弹窗总目的正文各章 + 已展开的附录各章；
	// 提前 return 之前调用，保 hooks 顺序稳定
	const spyAnchors = useMemo(() => {
		if (variant !== "dialog" || filtering || !model) return [];
		const mainAnchors = model.chapters.map((_, i) =>
			chapterAnchor("chapter", String(i + 1).padStart(2, "0")),
		);
		const appendixAnchors = appendixOpen
			? model.appendix.map((_, i) => chapterAnchor("appendix", `a${i + 1}`))
			: [];
		return [...mainAnchors, ...appendixAnchors];
	}, [variant, filtering, model, appendixOpen]);
	useScrollSpy(spyAnchors, setActiveTag);

	if (isLoading) {
		return (
			<div className="py-16 text-center">
				<p className="font-mono text-xs tracking-[0.2em] text-muted-foreground/60 uppercase">
					正在载入运行时规范
				</p>
				<div className="mx-auto mt-4 h-px w-16 animate-pulse bg-primary/40" />
			</div>
		);
	}
	if (isError || !model) {
		return (
			<div className="border-l-2 border-destructive/60 py-2 pl-4">
				<p className="text-sm font-medium text-foreground">规范暂时不可用</p>
				<p className="mt-1 text-xs text-muted-foreground">
					未能读取运行时 OpenAPI，请稍后重试。
				</p>
			</div>
		);
	}

	const isPage = variant === "page";
	const withMatches = (chapters: DocChapter[]) =>
		filtering
			? chapters.filter((c) => c.operations.some((op) => operationMatches(op, c.tag, query)))
			: chapters;
	const chapters = withMatches(model.chapters);
	const appendix = withMatches(model.appendix);
	const publicCount = model.chapters.reduce((sum, c) => sum + c.operations.length, 0);
	const adminCount = model.appendix.reduce((sum, c) => sum + c.operations.length, 0);
	const showToc = variant === "dialog" && !filtering;

	/* 检索条 sticky 常驻：只属于右栏内容列，滚动中随时可过滤。
		不用负边距外扩——会撑出 os-host 的横向滚动条 */
	const searchBlock = (
		<div className={cn(variant === "dialog" && "sticky top-0 z-10 bg-card py-2")}>
			<label
				className={cn(
					"flex items-center gap-3 border-b border-border/70 pb-2.5 transition-colors focus-within:border-primary/60",
					variant === "dialog" && "pr-9 sm:pr-11",
				)}
			>
				<Search className="size-4 shrink-0 text-muted-foreground/50" />
				<input
					type="search"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="过滤端点、摘要或标签……"
					className="w-full bg-transparent font-mono text-sm outline-none placeholder:text-muted-foreground/45"
				/>
				{filtering ? (
					<span className="shrink-0 font-mono text-[11px] text-muted-foreground/70 tabular-nums">
						{countMatches(model, query)}
					</span>
				) : null}
			</label>
		</div>
	);

	const endpointBody = (
		<>
			{searchBlock}
			<main
				className={cn(
					"min-w-0 space-y-14",
					isPage && "sm:space-y-16",
					!isPage && "mt-4 pb-6",
				)}
			>
				{chapters.map((chapter, index) => (
					<ChapterSection
						key={chapter.tag}
						chapter={chapter}
						query={query}
						model={model}
						anchor={chapterAnchor("chapter", String(index + 1).padStart(2, "0"))}
						marker={String(index + 1).padStart(2, "0")}
					/>
				))}
				<AppendixSection
					model={model}
					query={query}
					chapters={appendix}
					filtering={filtering}
					open={appendixOpen}
					onToggle={() => setAppendixOpen((v) => !v)}
				/>
			</main>
		</>
	);

	return (
		/* 弹窗：头部常驻，双栏各自独立滚动（纸壳内容区已交给本组件 overflow-hidden） */
		<div className={cn("text-foreground", !isPage && "flex h-full min-h-0 flex-col")}>
			<header className={cn(isPage ? "pb-8" : "pr-10 pb-2 sm:pr-14")}>
				<p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground/60 uppercase">
					API Reference
				</p>
				<div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
					<h1
						className={cn(
							"font-normal tracking-[-0.02em]",
							isPage ? "text-4xl sm:text-5xl" : "text-3xl sm:text-4xl",
						)}
					>
						{model.title}
					</h1>
					{model.version ? (
						<span className="font-mono text-xs text-muted-foreground/60">
							v{model.version.replace(/^v/, "")}
						</span>
					) : null}
				</div>
				<div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground/80">
					<span className="tabular-nums">{publicCount} 公开</span>
					<span aria-hidden className="text-muted-foreground/40">
						·
					</span>
					<span className="tabular-nums">{adminCount} 管理</span>
					<span aria-hidden className="text-muted-foreground/40">
						·
					</span>
					<span className="tabular-nums">{Object.keys(model.schemas).length} 模型</span>
					{variant === "dialog" ? (
						<>
							<span aria-hidden className="text-muted-foreground/40">
								·
							</span>
							<Link
								to="/docs"
								className="inline-flex items-center gap-0.5 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
							>
								独立页
								<ArrowUpRight className="size-3.5" />
							</Link>
						</>
					) : null}
				</div>

				{/* 描述仅独立页保留：弹窗空间留给正文 */}
				{isPage && model.description ? (
					<p className="mt-4 max-w-2xl font-serif text-sm leading-relaxed text-muted-foreground sm:text-base">
						{model.description}
					</p>
				) : null}
			</header>

			<div
				className={cn(
					isPage && "mt-7",
					!isPage && "mt-5 min-h-0 flex-1",
					showToc && "grid grid-cols-[13.5rem_minmax(0,1fr)] gap-10",
				)}
			>
				{showToc ? (
					<TocRail
						chapters={model.chapters}
						appendix={model.appendix}
						activeTag={activeTag}
						appendixOpen={appendixOpen}
						onOpenAppendix={() => setAppendixOpen(true)}
					/>
				) : null}
				{isPage ? (
					<div className="min-w-0">{endpointBody}</div>
				) : (
					/* 站点统一覆盖式滚动条；单一根子节点供内部 ResizeObserver 跟踪内容增高 */
					<OverlayScroll
						className="min-w-0 min-h-0"
						style={{ overscrollBehavior: "contain" }}
					>
						<div>{endpointBody}</div>
					</OverlayScroll>
				)}
			</div>
		</div>
	);
}

/**
 * 总目 scroll-spy：锚点章节进入视口顶部带时置为当前章；
 * anchors 变化（附录展开挂出新章）时重建观察。独立页/过滤态传空数组即停用。
 */
function useScrollSpy(anchors: string[], setActiveTag: (tag: string | null) => void) {
	useEffect(() => {
		if (anchors.length === 0) return;
		const sections = anchors
			.map((id) => document.getElementById(id))
			.filter((el): el is HTMLElement => el !== null);
		if (sections.length === 0) return;
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;
					// 章节标签挂在锚点 section 内层的 div 上
					const tag = entry.target
						.querySelector<HTMLElement>("[data-docs-chapter-tag]")
						?.getAttribute("data-docs-chapter-tag");
					if (tag) setActiveTag(tag);
				}
			},
			// 命中带 = 视口顶部 8%~38%：章头滚过弹窗顶即切高亮
			{ rootMargin: "-8% 0px -62% 0px" },
		);
		sections.forEach((el) => {
			observer.observe(el);
		});
		return () => observer.disconnect();
	}, [anchors, setActiveTag]);
}

/** 章节滚入视口的一次性淡入上移；reduce-motion 用户直接呈现。 */
function RevealSection({
	ariaLabel,
	anchor,
	children,
}: {
	ariaLabel: string;
	anchor?: string;
	children: ReactNode;
}) {
	const reduceMotion = useReducedMotion();
	return (
		<motion.section
			aria-label={ariaLabel}
			id={anchor}
			initial={reduceMotion ? false : { opacity: 0, y: 14 }}
			whileInView={{ opacity: 1, y: 0 }}
			/* 超长章节可见占比极低，用「任一像素入视口」触发，避免永不显现 */
			viewport={{ once: true }}
			transition={REVEAL_SPRING}
		>
			{children}
		</motion.section>
	);
}

/** 总目目录项：序号 + 章名 + 点线引导 + 端点数，当前章 primary 高亮。 */
function TocItem({
	index,
	label,
	count,
	anchor,
	active,
	onJump,
}: {
	index: string;
	label: string;
	count: number;
	anchor: string;
	active: boolean;
	onJump: (anchor: string) => void;
}) {
	return (
		<a
			href={`#${anchor}`}
			onClick={(e) => {
				e.preventDefault();
				onJump(anchor);
			}}
			aria-current={active ? "true" : undefined}
			className={cn(
				"group flex items-center gap-2 py-1.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
				active ? "text-primary" : "text-foreground/80 hover:text-primary",
			)}
		>
			<span className="font-mono text-[10px] tabular-nums">{index}</span>
			<span className="min-w-0 truncate">{label}</span>
			<span
				aria-hidden
				className={cn(
					"min-w-4 flex-1 self-center border-b border-dotted transition-colors",
					active ? "border-primary/50" : "border-border/70 group-hover:border-primary/40",
				)}
			/>
			<span className="font-mono text-[10px] text-muted-foreground/60 tabular-nums">
				{count}
			</span>
		</a>
	);
}

function TocRail({
	chapters,
	appendix,
	activeTag,
	appendixOpen,
	onOpenAppendix,
}: {
	chapters: DocChapter[];
	appendix: DocChapter[];
	activeTag: string | null;
	appendixOpen: boolean;
	/** 总目点附录章节时先展开附录册，再滚动到目标章。 */
	onOpenAppendix: () => void;
}) {
	const reduceMotion = useReducedMotion();
	const activeItemRef = useRef<HTMLLIElement | null>(null);
	// 当前章超出总目视野时跟随滚入（block:nearest 已在视野内则不动）
	// biome-ignore lint/correctness/useExhaustiveDependencies: activeTag 仅作触发器，滚动目标经 activeItemRef 读取
	useEffect(() => {
		activeItemRef.current?.scrollIntoView({ block: "nearest" });
	}, [activeTag]);
	const scrollTo = (anchor: string) => {
		document
			.getElementById(anchor)
			?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
	};
	const jump = (anchor: string, ensureAppendix = false) => {
		if (ensureAppendix && !appendixOpen) {
			onOpenAppendix();
			// 等附录章节挂载完成再滚，双 rAF 保证在 commit 之后
			requestAnimationFrame(() => {
				requestAnimationFrame(() => scrollTo(anchor));
			});
			return;
		}
		scrollTo(anchor);
	};
	return (
		<nav aria-label="文档总目" className="min-h-0">
			<OverlayScroll className="h-full">
				<div className="pr-2">
					<p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground/60 uppercase">
						Contents
					</p>
					<ul className="mt-3">
						{chapters.map((chapter, index) => (
							<li
								key={chapter.tag}
								ref={chapter.tag === activeTag ? activeItemRef : undefined}
							>
								<TocItem
									index={String(index + 1).padStart(2, "0")}
									label={chapter.tag}
									count={chapter.operations.length}
									anchor={chapterAnchor(
										"chapter",
										String(index + 1).padStart(2, "0"),
									)}
									active={activeTag === chapter.tag}
									onJump={jump}
								/>
							</li>
						))}
					</ul>
					{appendix.length > 0 ? (
						<>
							<hr className="my-3 border-t border-border/40" />
							<p className="pt-1 font-mono text-[10px] tracking-[0.2em] text-muted-foreground/60 uppercase">
								Appendix
							</p>
							<ul className="mt-1">
								{appendix.map((chapter, index) => (
									<li
										key={chapter.tag}
										ref={chapter.tag === activeTag ? activeItemRef : undefined}
									>
										<TocItem
											index={`A${index + 1}`}
											label={chapter.tag}
											count={chapter.operations.length}
											anchor={chapterAnchor("appendix", `a${index + 1}`)}
											active={activeTag === chapter.tag}
											onJump={(anchor) => jump(anchor, true)}
										/>
									</li>
								))}
							</ul>
						</>
					) : null}
				</div>
			</OverlayScroll>
		</nav>
	);
}

function ChapterSection({
	chapter,
	query,
	marker,
	model,
	anchor,
	eyebrowPrefix = "Chapter",
}: {
	chapter: DocChapter;
	query: string;
	marker: string;
	model: DocsModel;
	/** 锚点 id，供总目跳转与 scroll-spy 定位。 */
	anchor: string;
	/** 附录章节传 "Appendix"，与正文 Chapter 区分册别。 */
	eyebrowPrefix?: string;
}) {
	const operations = chapter.operations.filter((op) => operationMatches(op, chapter.tag, query));
	if (operations.length === 0) return null;
	return (
		<RevealSection ariaLabel={chapter.tag} anchor={anchor}>
			{/* data 属性供 scroll-spy 识别当前章；scroll-mt 让 sticky 检索条不遮章头 */}
			<div className="scroll-mt-20" data-docs-chapter-tag={chapter.tag}>
				<header className="mb-5">
					<p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground/60 uppercase">
						{eyebrowPrefix} {marker} · {operations.length} endpoints
					</p>
					<h3 className="mt-1.5 text-2xl font-normal tracking-[-0.01em]">
						{chapter.tag}
					</h3>
				</header>
				<div className="divide-y divide-border/30">
					{operations.map((op) => (
						<OperationRow key={op.id} op={op} schemas={model.schemas} />
					))}
				</div>
			</div>
		</RevealSection>
	);
}

function AppendixSection({
	model,
	query,
	chapters,
	filtering,
	open,
	onToggle,
}: {
	model: DocsModel;
	query: string;
	chapters: DocChapter[];
	filtering: boolean;
	/** 受控开合：总目点附录章节时由外部展开。 */
	open: boolean;
	onToggle: () => void;
}) {
	const visible = filtering || open;
	const total = chapters.reduce((n, c) => n + c.operations.length, 0);
	const scopeTotal = model.appendix.reduce((n, c) => n + c.operations.length, 0);
	if (scopeTotal === 0) return null;
	return (
		<RevealSection ariaLabel="附录" anchor={chapterAnchor("appendix", "index")}>
			<div className="scroll-mt-20">
				<button
					type="button"
					onClick={onToggle}
					aria-expanded={visible}
					className="group w-full text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
				>
					<p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] text-muted-foreground/60 uppercase">
						<ArrowRight
							className={cn(
								"size-3 transition-transform duration-200 group-hover:translate-x-0.5",
								visible && "rotate-90",
							)}
						/>
						<span>Appendix · {scopeTotal} admin endpoints</span>
						<span className="ml-auto tracking-normal text-muted-foreground/50">
							{visible ? "点击收起" : "默认折叠"}
						</span>
					</p>
					<h3 className="mt-1.5 text-2xl font-normal tracking-[-0.01em] transition-colors group-hover:text-primary">
						管理端点
					</h3>
				</button>
				{open || filtering ? (
					<div className="mt-7 space-y-14 sm:space-y-16">
						{chapters.map((chapter, index) => (
							<ChapterSection
								key={chapter.tag}
								chapter={chapter}
								query={query}
								model={model}
								anchor={chapterAnchor("appendix", `a${index + 1}`)}
								marker={`A${index + 1}`}
								eyebrowPrefix="Appendix"
							/>
						))}
						{total === 0 ? (
							<p className="border-l border-border/80 pl-4 text-xs text-muted-foreground">
								没有端点命中当前过滤词。
							</p>
						) : null}
					</div>
				) : null}
			</div>
		</RevealSection>
	);
}

function countMatches(model: DocsModel, query: string): number {
	let n = 0;
	for (const chapter of [...model.chapters, ...model.appendix]) {
		n += chapter.operations.filter((op) => operationMatches(op, chapter.tag, query)).length;
	}
	return n;
}
